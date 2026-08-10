import { FastifyRequest, FastifyReply } from 'fastify';
import bcrypt from 'bcrypt';
import { eq } from 'drizzle-orm';
import { OAuth2Client } from 'google-auth-library';
import { db } from '../db/db.js';
import { users } from '../db/schema.js';
import { config } from '../config/env.js';
import { validateEmail, validatePassword } from '../utils/validators.js';

export async function handleRegister(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { email, password, name } = request.body as any;

    if (!email || !password || !name) {
      return reply.status(400).send({ error: 'All fields (email, password, name) are required.' });
    }

    if (!validateEmail(email)) {
      return reply.status(400).send({ error: 'Invalid email format.' });
    }

    if (!validatePassword(password)) {
      return reply.status(400).send({ 
        error: 'Password must be between 12 and 100 characters long and include at least one uppercase letter, one lowercase letter, one number, and one special character.' 
      });
    }

    const existingUser = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (existingUser.length > 0) {
      return reply.status(409).send({ error: 'A user with this email already exists.' });
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const insertedRows = await db.insert(users).values({
      name,
      email,
      password: hashedPassword,
      role: 'user',
    }).returning();

    const createdUser = insertedRows[0];

    if (!createdUser) {
      throw new Error('Failed to retrieve created user from database.');
    }

    return reply.status(201).send({ 
      message: 'User registered successfully!',
      user: {
        id: createdUser.id,
        name: createdUser.name,
        email: createdUser.email,
        role: createdUser.role,
        picture: createdUser.picture ?? null
      } 
    });

  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: 'Internal server error.' });
  }
}

export async function handleLogin(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { email, password } = request.body as any;

    if (!email || !password) {
      return reply.status(400).send({ error: 'Email and password are required.' });
    }

    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (!user) {
      return reply.status(401).send({ error: 'Invalid email or password.' });
    }

    // Google-only accounts have no password set; reject password login for them
    if (!user.password) {
      return reply.status(401).send({ error: 'This account uses Google Sign-In. Please use Continue with Google.' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return reply.status(401).send({ error: 'Invalid email or password.' });
    }

    const token = (request.server as any).jwt.sign(
      { 
        id: user.id, 
        email: user.email,
        role: user.role
      },
      { expiresIn: '1d' }
    );

    return reply.status(200).send({ 
      message: 'Login successful!',
      token, 
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        picture: user.picture ?? null
      }
    });

  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: 'Internal server error.' });
  }
}

export async function handleGoogleAuth(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { credential } = request.body as { credential?: string };

    if (!credential) {
      return reply.status(400).send({ error: 'Missing Google credential token.' });
    }

    const clientId = config.googleClientId;
    if (!clientId) {
      return reply.status(503).send({ error: 'Google Sign-In is not configured on the server.' });
    }

    const client = new OAuth2Client(clientId);
    let payload;
    try {
      const ticket = await client.verifyIdToken({
        idToken: credential,
        audience: clientId,
      });
      payload = ticket.getPayload();
    } catch (err) {
      request.log.error(err);
      return reply.status(401).send({ error: 'Invalid Google credential.' });
    }

    if (!payload || !payload.email || !payload.email_verified) {
      return reply.status(401).send({ error: 'Google account email is not verified.' });
    }

    const googleId = payload.sub as string;
    const email = payload.email;
    const name = payload.name || email.split('@')[0];
    const picture = payload.picture || null;

    // Find an existing user by googleId OR by email
    const existingByGoogle = await db.select().from(users).where(eq(users.googleId, googleId)).limit(1);
    const existingByEmail = existingByGoogle.length === 0
      ? await db.select().from(users).where(eq(users.email, email)).limit(1)
      : [];

    let user;
    if (existingByGoogle[0]) {
      // Already linked: refresh the avatar if Google re-sends one
      if (picture && existingByGoogle[0].picture !== picture) {
        const [updated] = await db.update(users)
          .set({ picture })
          .where(eq(users.id, existingByGoogle[0].id))
          .returning();
        user = updated;
      } else {
        user = existingByGoogle[0];
      }
    } else if (existingByEmail[0]) {
      // Link googleId to an existing email/password account
      const [updated] = await db.update(users)
        .set({ googleId, ...(picture ? { picture } : {}) })
        .where(eq(users.id, existingByEmail[0].id))
        .returning();
      user = updated;
    } else {
      // Create a brand new Google-only account
      const [created] = await db.insert(users).values({
        name,
        email,
        password: null,
        googleId,
        picture,
        role: 'user',
      }).returning();
      user = created;
    }

    if (!user) {
      throw new Error('Failed to resolve Google user.');
    }

    const token = (request.server as any).jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      { expiresIn: '1d' }
    );

    return reply.status(200).send({
      message: 'Google Sign-In successful!',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        picture: user.picture ?? null,
      },
    });
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: 'Internal server error.' });
  }
}

export async function handleUpdateProfile(request: FastifyRequest, reply: FastifyReply) {
  try {
    const userId = (request.user as any).id;
    const { name } = request.body as { name?: string };

    if (!name || !name.trim()) {
      return reply.status(400).send({ error: 'Name is required.' });
    }
    if (name.trim().length > 100) {
      return reply.status(400).send({ error: 'Name must be 100 characters or fewer.' });
    }

    const [updated] = await db.update(users)
      .set({ name: name.trim() })
      .where(eq(users.id, userId))
      .returning();

    if (!updated) {
      return reply.status(404).send({ error: 'User not found.' });
    }

    return reply.status(200).send({
      message: 'Profile updated successfully!',
      user: {
        id: updated.id,
        name: updated.name,
        email: updated.email,
        role: updated.role,
        picture: updated.picture ?? null,
      },
    });
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: 'Internal server error.' });
  }
}

export async function handleRefresh(request: FastifyRequest, reply: FastifyReply) {
  try {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.status(401).send({ error: 'Missing token.' });
    }

    let payload: any;
    try {
      payload = await request.jwtVerify({ ignoreExpiration: true } as any);
    } catch (err) {
      request.log.error(err);
      return reply.status(401).send({ error: 'Invalid or forged token.' });
    }

    // Grace period: never resurrect a token that expired more than 30 days ago.
    if (payload.exp) {
      const expiredMsAgo = Date.now() - payload.exp * 1000;
      if (expiredMsAgo > 30 * 24 * 60 * 60 * 1000) {
        return reply.status(401).send({ error: 'Session expired. Please sign in again.' });
      }
    }

    const [user] = await db.select().from(users).where(eq(users.id, payload.id)).limit(1);
    if (!user) {
      return reply.status(401).send({ error: 'User no longer exists.' });
    }

    const token = (request.server as any).jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      { expiresIn: '1d' }
    );

    return reply.status(200).send({
      message: 'Token refreshed successfully!',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        picture: user.picture ?? null,
      },
    });
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: 'Internal server error.' });
  }
}

export async function handleGetMe(request: FastifyRequest, reply: FastifyReply) {
  try {
    const userId = (request.user as any).id;

    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) {
      return reply.status(404).send({ error: 'User not found.' });
    }

    return reply.status(200).send({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        picture: user.picture ?? null,
      },
    });
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: 'Internal server error.' });
  }
}
