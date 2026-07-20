import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import fs from 'fs';
import path from 'path';
const projectId = process.env.FIREBASE_PROJECT_ID || 'gym-management-auth';
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY;
const serviceAccountPath = path.resolve(process.cwd(), 'firebase-service-account.json');
try {
    if (fs.existsSync(serviceAccountPath)) {
        const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
        initializeApp({
            credential: cert(serviceAccount),
        });
    }
    else if (clientEmail && privateKey) {
        initializeApp({
            credential: cert({
                projectId,
                clientEmail,
                privateKey: privateKey.replace(/\\n/g, '\n'),
            }),
        });
    }
    else {
        initializeApp({
            projectId: projectId,
        });
    }
}
catch (error) {
    if (!/already exists/.test(error.message)) {
        console.error('Firebase Admin initialization error:', error);
    }
}
/**
 * Verifies a Firebase ID token sent from the client.
 * Returns the decoded token containing email, phone number, name, etc.
 */
export const verifyFirebaseToken = async (idToken) => {
    const isMockAllowed = process.env.FIREBASE_MOCK === 'true' || process.env.NODE_ENV !== 'production';
    // Developer mock mode bypass for local testing
    if (isMockAllowed && idToken.startsWith('mock-')) {
        if (idToken.startsWith('mock-google-token')) {
            return {
                uid: 'mock-google-uid-12345',
                email: 'test_google_user@gymos.com',
                name: 'John Google Test',
                firebase: {
                    sign_in_provider: 'google.com'
                }
            };
        }
        if (idToken.startsWith('mock-phone-token:')) {
            const phoneNumber = idToken.split(':')[1] || '+919999999999';
            return {
                uid: `mock-phone-uid-${phoneNumber.replace('+', '')}`,
                phone_number: phoneNumber,
                name: 'Jane Phone Test',
                firebase: {
                    sign_in_provider: 'phone'
                }
            };
        }
    }
    try {
        const decodedToken = await getAuth().verifyIdToken(idToken);
        return decodedToken;
    }
    catch (error) {
        console.error('Error verifying Firebase ID token:', error);
        throw new Error('Invalid or expired Firebase ID token');
    }
};
