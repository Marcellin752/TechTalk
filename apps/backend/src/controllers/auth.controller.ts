import { FastifyRequest, FastifyReply } from 'fastify';
import bcrypt from 'bcrypt';
import { eq } from 'drizzle-orm';
import { OAuth2Client } from 'google-auth-library';
import { db } from '../db/db.js';
import { users } from '../db/schema.js';
import { config } from '../config/env.js';
import { validateEmail, validatePassword } from '../utils/validators.js';

/**
 * Handles new user registration.
 * By default, any newly registered user gets assigned the 'user' role.
 */
export async function handleRegister(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { email, password, name } = request.body as any;

    // 1. Validation checks
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

    // 2. Check for existing user
    const existingUser = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (existingUser.length > 0) {
      return reply.status(409).send({ error: 'A user with this email already exists.' });
    }

    // 3. Hash password and insert user into database
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const insertedRows = await db.insert(users).values({
      name,
      email,
      password: hashedPassword,
      role: 'user', // Explicitly setting the default role for safety
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

/**
 * Handles user authentication and logs them in.
 * Appends the 'role' property into the signed JWT token payload.
 */
export async function handleLogin(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { email, password } = request.body as any;

    if (!email || !password) {
      return reply.status(400).send({ error: 'Email and password are required.' });
    }

    // 1. Fetch user by email
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (!user) {
      return reply.status(401).send({ error: 'Invalid email or password.' });
    }

    // 2a. Google-only accounts have no password set; reject password login for them
    if (!user.password) {
      return reply.status(401).send({ error: 'This account uses Google Sign-In. Please use Continue with Google.' });
    }

    // 2b. Compare passwords
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return reply.status(401).send({ error: 'Invalid email or password.' });
    }

    // 3. Generate JWT Token (Including the user role)
    const token = (request.server as any).jwt.sign(
      { 
        id: user.id, 
        email: user.email,
        role: user.role // 👈 CRITICAL: Included so 'requireAdmin' decorator can validate it
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

/**
 * Handles Google One-Tap authentication via an ID token (credential).
 * Verifies the token with Google, then upserts the user (create or attach
 * googleId to an existing email account) and signs the standard TechTalk JWT.
 */
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

    // 1. Verify the ID token with Google
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

    // 2. Find an existing user by googleId OR by email
    const existingByGoogle = await db.select().from(users).where(eq(users.googleId, googleId)).limit(1);
    const existingByEmail = existingByGoogle.length === 0
      ? await db.select().from(users).where(eq(users.email, email)).limit(1)
      : [];

    let user;
    if (existingByGoogle[0]) {
      // Already linked: regular Google sign-in. Refresh the avatar if Google re-sends one.
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
      // 3a. Link googleId to an existing email/password account
      const [updated] = await db.update(users)
        .set({ googleId, ...(picture ? { picture } : {}) })
        .where(eq(users.id, existingByEmail[0].id))
        .returning();
      user = updated;
    } else {
      // 3b. Create a brand new Google-only account
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

    // 4. Sign the standard TechTalk JWT
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

/**
 * Updates the authenticated user's profile (currently the display name).
 */
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
