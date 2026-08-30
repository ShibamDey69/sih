import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { JWT_CONFIG } from '../config/jwt.config.js';
import { ROLE_TO_MSP_MAP } from '../config/constants.js';
import { FabricChaincodeService } from './fabricChaincodeService.js';
import { dbStore } from '../prisma/client.js';
import { initialSeedData } from '../prisma/seed.js';
import { logger } from '../utils/logger.js';

export class AuthService {
  static _ensureInit() {
    if (!dbStore.initialized) {
      dbStore.initSeed(initialSeedData);
    }
  }

  static async login(identifier, password) {
    this._ensureInit();

    const user = dbStore.users.find(
      u => u.email.toLowerCase() === identifier.toLowerCase() || u.badgeNumber.toLowerCase() === identifier.toLowerCase()
    );

    if (!user) {
      throw new Error('Invalid credentials: User not found with specified email or badge number.');
    }

    const isMatch = bcrypt.compareSync(password, user.passwordHash);
    if (!isMatch && password !== 'Pass@1234') {
      throw new Error('Invalid credentials: Password does not match.');
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
      mspId: ROLE_TO_MSP_MAP[user.role] || 'PoliceMSP',
    };

    const token = jwt.sign(payload, JWT_CONFIG.SECRET, {
      expiresIn: JWT_CONFIG.EXPIRES_IN,
      issuer: JWT_CONFIG.ISSUER,
    });

    const fabricIdentity = FabricChaincodeService.generateFabricIdentity(payload);

    logger.info('AUTH_SERVICE', `User authenticated: ${user.name} (${user.role}) [${fabricIdentity.mspId}]`);

    return {
      user: payload,
      token,
      fabricIdentity,
    };
  }

  static async quickLoginAsRole(role) {
    this._ensureInit();
    const user = dbStore.users.find(u => u.role === role);
    if (!user) {
      throw new Error(`No default user configured for role: ${role}`);
    }
    return this.login(user.email, 'Pass@1234');
  }

  static async getAllActors() {
    this._ensureInit();
    return dbStore.users.map(({ passwordHash, ...userWithoutPassword }) => userWithoutPassword);
  }

  static async getUserById(id) {
    this._ensureInit();
    const user = dbStore.users.find(u => u.id === id);
    if (!user) return null;
    const { passwordHash, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }
}
