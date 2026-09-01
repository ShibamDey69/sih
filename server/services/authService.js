import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

import { JWT_CONFIG } from '../config/jwt.config.js';
import { ROLE_TO_MSP_MAP } from '../config/constants.js';
import { FabricChaincodeService } from './fabricChaincodeService.js';
import { prisma } from '../prisma/client.js';
import { logger } from '../utils/logger.js';

export class AuthService {

  static async login(identifier, password) {
    if (!identifier || !password) {
      throw new Error('Identifier and password are required.');
    }

    const normalizedIdentifier = identifier.trim();

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          {
            email: {
              equals: normalizedIdentifier,
              mode: 'insensitive',
            },
          },
          {
            badgeNumber: {
              equals: normalizedIdentifier,
              mode: 'insensitive',
            },
          },
        ],
      },
    });

    if (!user) {
      throw new Error('Invalid credentials.');
    }

    const isMatch = await bcrypt.compare(
      password,
      user.passwordHash
    );

    if (!isMatch) {
      throw new Error('Invalid credentials.');
    }

    const mspId = ROLE_TO_MSP_MAP[user.role];

    if (!mspId) {
      throw new Error(`No MSP configured for role: ${user.role}`);
    }

    const payload = {
      id: user.id,
      badgeNumber: user.badgeNumber,
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department,
      station: user.station,
      designation: user.designation,
      mspId,
    };

    const token = jwt.sign(
      payload,
      JWT_CONFIG.SECRET,
      {
        expiresIn: JWT_CONFIG.EXPIRES_IN,
        issuer: JWT_CONFIG.ISSUER,
      }
    );

    const fabricIdentity =
      FabricChaincodeService.generateFabricIdentity(payload);

    logger.info(
      'AUTH_SERVICE',
      `User authenticated: ${user.name} (${user.role}) [${fabricIdentity.mspId}]`
    );

    return {
      user: payload,
      token,
      fabricIdentity,
    };
  }

  static async getAllActors() {
    return await prisma.user.findMany({
      select: {
        id: true,
        badgeNumber: true,
        name: true,
        email: true,
        role: true,
        department: true,
        station: true,
        designation: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        name: 'asc',
      },
    });
  }

  static async getUserById(id) {
    return await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        badgeNumber: true,
        name: true,
        email: true,
        role: true,
        department: true,
        station: true,
        designation: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }
}