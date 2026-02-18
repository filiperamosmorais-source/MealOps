import jwt from '@fastify/jwt';
import type { FastifyInstance } from 'fastify';

export async function registerAuth(app: FastifyInstance) {
	const secret = process.env.JWT_SECRET;
	if (!secret) throw new Error('JWT_SECRET missing in apps/api/.env');

	await app.register(jwt, { secret });

	app.decorate('authenticate', async (req: any, reply: any) => {
		try {
			await req.jwtVerify();
		} catch {
			return reply.code(401).send({ error: 'Unauthorized' });
		}
	});
}
