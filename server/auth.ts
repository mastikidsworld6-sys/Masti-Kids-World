import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth, DecodedIdToken } from 'firebase-admin/auth';
import { Request, Response, NextFunction } from 'express';
import firebaseConfig from '../firebase-applet-config.json';

if (!getApps().length) {
  initializeApp({
    projectId: firebaseConfig.projectId,
  });
}

export const adminAuth = getAuth();

export interface AuthRequest extends Request {
  user?: DecodedIdToken;
}

export async function verifyIdTokenString(token: string): Promise<DecodedIdToken> {
  return adminAuth.verifyIdToken(token);
}

export const requireAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized: Missing authentication token' });
    return;
  }

  const token = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await verifyIdTokenString(token);
    req.user = decodedToken;
    next();
  } catch (err) {
    console.error('Auth verification failed:', err instanceof Error ? err.message : 'Unknown error');
    res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
  }
};
