import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { dbStore } from '../prisma/client.js';
import { initialSeedData } from '../prisma/seed.js';
import { logger } from '../utils/logger.js';

export class UserService {
  static _ensureInit() {
    if (!dbStore.initialized) {
      dbStore.initSeed(initialSeedData);
    }
  }

  static async getAllUsers(filters = {}) {
    this._ensureInit();
    let users = [...dbStore.users];

    if (filters.role) {
      users = users.filter(u => u.role === filters.role);
    }

    if (filters.department) {
      users = users.filter(u => u.department.toLowerCase().includes(filters.department.toLowerCase()));
    }

    if (filters.search) {
      const q = filters.search.toLowerCase();
      users = users.filter(u => 
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.badgeNumber.toLowerCase().includes(q) ||
        u.station.toLowerCase().includes(q)
      );
    }

    return users.map(({ passwordHash, ...safeUser }) => safeUser);
  }

  static async getUserById(id) {
    this._ensureInit();
    const user = dbStore.users.find(u => u.id === id);
    if (!user) {
      throw new Error(`User with ID ${id} was not found.`);
    }
    const { passwordHash, ...safeUser } = user;
    return safeUser;
  }

  static async createUser(userData) {
    this._ensureInit();

    const {
      name,
      email,
      badgeNumber,
      role = 'INVESTIGATING_OFFICER',
      department = 'CID - Cyber Crime Division',
      station = 'Delhi Central Police Station',
      designation = 'Sub-Inspector',
      password = 'Pass@1234',
    } = userData;

    if (!name || !email || !badgeNumber) {
      throw new Error('Missing required user fields: name, email, and badgeNumber are mandatory.');
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error('Invalid email address format.');
    }

    const existingEmail = dbStore.users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (existingEmail) {
      throw new Error(`A user with email "${email}" already exists.`);
    }

    const existingBadge = dbStore.users.find(u => u.badgeNumber.toLowerCase() === badgeNumber.toLowerCase());
    if (existingBadge) {
      throw new Error(`A user with badge number "${badgeNumber}" already exists.`);
    }

    const validRoles = [
      'ADMIN',
      'INVESTIGATING_OFFICER',
      'STATION_HOUSE_OFFICER',
      'FORENSIC_EXAMINER',
      'PUBLIC_PROSECUTOR',
      'JUDICIAL_OFFICER'
    ];

    if (!validRoles.includes(role)) {
      throw new Error(`Invalid role "${role}". Allowed roles: ${validRoles.join(', ')}`);
    }

    const passwordHash = bcrypt.hashSync(password, 10);
    const newUser = {
      id: crypto.randomUUID(),
      name,
      email: email.toLowerCase(),
      badgeNumber: badgeNumber.toUpperCase(),
      role,
      department,
      station,
      designation,
      passwordHash,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      active: true,
    };

    dbStore.users.push(newUser);
    logger.info('USER_SERVICE', `New user created successfully: ${newUser.name} [${newUser.role}] (${newUser.badgeNumber})`);

    const { passwordHash: _, ...safeUser } = newUser;
    return safeUser;
  }

  static async updateUser(id, updateData) {
    this._ensureInit();

    const userIndex = dbStore.users.findIndex(u => u.id === id);
    if (userIndex === -1) {
      throw new Error(`User with ID "${id}" was not found.`);
    }

    const existingUser = dbStore.users[userIndex];

    if (updateData.email && updateData.email.toLowerCase() !== existingUser.email.toLowerCase()) {
      const emailTaken = dbStore.users.find(u => u.email.toLowerCase() === updateData.email.toLowerCase() && u.id !== id);
      if (emailTaken) {
        throw new Error(`Email "${updateData.email}" is already in use by another user.`);
      }
      existingUser.email = updateData.email.toLowerCase();
    }

    if (updateData.badgeNumber && updateData.badgeNumber.toUpperCase() !== existingUser.badgeNumber.toUpperCase()) {
      const badgeTaken = dbStore.users.find(u => u.badgeNumber.toUpperCase() === updateData.badgeNumber.toUpperCase() && u.id !== id);
      if (badgeTaken) {
        throw new Error(`Badge number "${updateData.badgeNumber}" is already in use by another user.`);
      }
      existingUser.badgeNumber = updateData.badgeNumber.toUpperCase();
    }

    if (updateData.name) existingUser.name = updateData.name;
    if (updateData.role) {
      const validRoles = [
        'ADMIN',
        'INVESTIGATING_OFFICER',
        'STATION_HOUSE_OFFICER',
        'FORENSIC_EXAMINER',
        'PUBLIC_PROSECUTOR',
        'JUDICIAL_OFFICER'
      ];
      if (!validRoles.includes(updateData.role)) {
        throw new Error(`Invalid role "${updateData.role}". Allowed roles: ${validRoles.join(', ')}`);
      }
      existingUser.role = updateData.role;
    }
    if (updateData.department) existingUser.department = updateData.department;
    if (updateData.station) existingUser.station = updateData.station;
    if (updateData.designation) existingUser.designation = updateData.designation;
    if (typeof updateData.active === 'boolean') existingUser.active = updateData.active;

    if (updateData.password) {
      existingUser.passwordHash = bcrypt.hashSync(updateData.password, 10);
    }

    existingUser.updatedAt = new Date().toISOString();
    dbStore.users[userIndex] = existingUser;

    logger.info('USER_SERVICE', `User updated successfully: ${existingUser.name} (${existingUser.id})`);

    const { passwordHash, ...safeUser } = existingUser;
    return safeUser;
  }

  static async deleteUser(id) {
    this._ensureInit();
    const userIndex = dbStore.users.findIndex(u => u.id === id);
    if (userIndex === -1) {
      throw new Error(`User with ID "${id}" was not found.`);
    }

    const [deletedUser] = dbStore.users.splice(userIndex, 1);
    logger.info('USER_SERVICE', `User deleted: ${deletedUser.name} (${deletedUser.badgeNumber})`);

    const { passwordHash, ...safeUser } = deletedUser;
    return safeUser;
  }
}
