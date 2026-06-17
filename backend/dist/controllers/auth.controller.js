"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getProfile = exports.login = exports.register = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const prisma_js_1 = __importDefault(require("../config/prisma.js"));
const client_1 = require("@prisma/client");
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-jwt-key-replace-this-in-production';
const register = async (req, res) => {
    try {
        const { email, password, firstName, lastName, role } = req.body;
        if (!email || !password || !firstName || !lastName) {
            return res.status(400).json({ error: 'All fields are required' });
        }
        // Check if user exists
        const existingUser = await prisma_js_1.default.user.findUnique({ where: { email } });
        if (existingUser) {
            return res.status(400).json({ error: 'User already exists' });
        }
        // Hash password
        const salt = await bcryptjs_1.default.genSalt(10);
        const passwordHash = await bcryptjs_1.default.hash(password, salt);
        // Determine role (default to MEMBER)
        const userRole = role && Object.values(client_1.UserRole).includes(role) ? role : client_1.UserRole.MEMBER;
        // Use transaction to create User and if they are a MEMBER, create Member profile
        const result = await prisma_js_1.default.$transaction(async (tx) => {
            const user = await tx.user.create({
                data: {
                    email,
                    passwordHash,
                    firstName,
                    lastName,
                    role: userRole,
                },
            });
            if (userRole === client_1.UserRole.MEMBER) {
                const member = await tx.member.create({
                    data: {
                        userId: user.id,
                        status: client_1.MemberStatus.ACTIVE,
                    },
                });
                return { user, member };
            }
            return { user };
        });
        const token = jsonwebtoken_1.default.sign({ id: result.user.id, email: result.user.email, role: result.user.role }, JWT_SECRET, { expiresIn: '24h' });
        const { passwordHash: _, ...userWithoutPassword } = result.user;
        return res.status(201).json({
            message: 'User registered successfully',
            user: userWithoutPassword,
            token,
        });
    }
    catch (error) {
        console.error('Registration error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
exports.register = register;
const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }
        const user = await prisma_js_1.default.user.findUnique({
            where: { email },
            include: { member: true },
        });
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        const isPasswordMatch = await bcryptjs_1.default.compare(password, user.passwordHash);
        if (!isPasswordMatch) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        const token = jsonwebtoken_1.default.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
        const { passwordHash: _, ...userWithoutPassword } = user;
        return res.status(200).json({
            message: 'Login successful',
            user: userWithoutPassword,
            token,
        });
    }
    catch (error) {
        console.error('Login error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
exports.login = login;
const getProfile = async (req, res) => {
    try {
        const user = await prisma_js_1.default.user.findUnique({
            where: { id: req.user.id },
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                role: true,
                createdAt: true,
                member: {
                    select: {
                        id: true,
                        status: true,
                        joinDate: true,
                        emergencyContact: true,
                        subscriptions: {
                            include: {
                                plan: true,
                                payments: true,
                            },
                            orderBy: { startDate: 'desc' },
                            take: 1,
                        },
                    },
                },
            },
        });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        return res.status(200).json({ user });
    }
    catch (error) {
        console.error('Profile fetch error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
exports.getProfile = getProfile;
