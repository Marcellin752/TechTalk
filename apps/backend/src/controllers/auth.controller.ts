import { FastifyRequest, FastifyReply } from 'fastify';
import bcrypt from 'bcrypt';
import { eq } from 'drizzle-orm';
import { db } from '../db/db.js';
import { users } from '../db/schema.js';
import { validateEmail, validatePassword } from '../utils/validators.js';

export async function handleRegister(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { email, password, name } = request.body as any;

    // 1. Validate required fields
    if (!email || !password || !name) {
      return reply.status(400).send({ error: 'All fields (email, password, name) are required.' });
    }

    // 2. Structural validations (Email and password safety rules)
    if (!validateEmail(email)) {
      return reply.status(400).send({ error: 'Invalid email format.' });
    }

    if (!validatePassword(password)) {
      return reply.status(400).send({ 
        error: 'Password must be between 12 and 100 characters long and include at least one uppercase letter, one lowercase letter, one number, and one special character.' 
      });
    }

    // 3. Database check for preexisting account
    const existingUser = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (existingUser.length > 0) {
      return reply.status(409).send({ error: 'A user with this email already exists.' });
    }

    // 4. Secure password hashing before database storage
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // 5. Database execution using Drizzle ORM
    // We fetch all inserted columns raw to prevent mapping errors with older Drizzle versions
    const insertedRows = await db.insert(users).values({
      name,
      email,
      password: hashedPassword,
    }).returning();

    const createdUser = insertedRows[0];

    if (!createdUser) {
      throw new Error('Failed to retrieve created user from database.');
    }

    // 6. Return the newly created user data (Safely removing the password hash from response)
    return reply.status(201).send({ 
      message: 'User registered successfully!',
      user: {
        id: createdUser.id,
        name: createdUser.name,
        email: createdUser.email
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

    // Fetch user record by email
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (!user) {
      return reply.status(401).send({ error: 'Invalid email or password.' });
    }

    // Verify raw input password against hashed storage password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return reply.status(401).send({ error: 'Invalid email or password.' });
    }

    return reply.status(200).send({ 
      message: 'Login successful!',
      user: {
        id: user.id,
        name: user.name,
        email: user.email
      }
    });

  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: 'Internal server error.' });
  }
}
