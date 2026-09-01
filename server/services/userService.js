import bcrypt from 'bcryptjs';
import { prisma } from '../prisma/client.js';
import { logger } from '../utils/logger.js';

const SAFE_USER_SELECT = {
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
};

const VALID_ROLES = [
  'INVESTIGATING_OFFICER',
  'STATION_IN_CHARGE',
  'FORENSIC_EXAMINER',
  'PROSECUTOR',
  'COURT_CLERK_JUDGE',
  'ADMIN',
];

export class UserService {
  static async getAllUsers(filters = {}) {
    const where = {};

    if (filters.role) {
      where.role = filters.role;
    }

    if (filters.department) {
      where.department = {
        contains: filters.department,
        mode: 'insensitive',
      };
    }

    if (filters.search) {
      const q = filters.search.trim();
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { badgeNumber: { contains: q, mode: 'insensitive' } },
        { station: { contains: q, mode: 'insensitive' } },
      ];
    }

    return await prisma.user.findMany({
      where,
      select: SAFE_USER_SELECT,
      orderBy: { createdAt: 'desc' },
    });
  }

  static async getUserById(id) {
    const user = await prisma.user.findUnique({
      where: { id },
      select: SAFE_USER_SELECT,
    });

    if (!user) {
      throw new Error(`User with ID ${id} was not found.`);
    }

    return user;
  }

  static async createUser(userData) {
    const {
      name,
      email,
      password,
      badgeNumber,
      role ,
      department,
      station ,
      designation ,
      
    } = userData;

    if (!name || !email || !password ||!badgeNumber || !role || !department || !station || !designation) {
      throw new Error('Missing required user fields: name, email, and badgeNumber are mandatory.');
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error('Invalid email address format.');
    }

    const normalizedRole = role === 'STATION_HOUSE_OFFICER' ? 'STATION_IN_CHARGE' : (role === 'PUBLIC_PROSECUTOR' ? 'PROSECUTOR' : (role === 'JUDICIAL_OFFICER' ? 'COURT_CLERK_JUDGE' : role));

    if (!VALID_ROLES.includes(normalizedRole)) {
      throw new Error(`Invalid role "${role}". Allowed roles: ${VALID_ROLES.join(', ')}`);
    }

    const existingEmail = await prisma.user.findFirst({
      where: { email: { equals: email.trim(), mode: 'insensitive' } },
    });
    if (existingEmail) {
      throw new Error(`A user with email "${email}" already exists.`);
    }

    const existingBadge = await prisma.user.findFirst({
      where: { badgeNumber: { equals: badgeNumber.trim(), mode: 'insensitive' } },
    });
    if (existingBadge) {
      throw new Error(`A user with badge number "${badgeNumber}" already exists.`);
    }

    const passwordHash = bcrypt.hashSync(password, 10);

    const newUser = await prisma.user.create({
      data: {
        name,
        email: email.toLowerCase().trim(),
        passwordHash,
        badgeNumber: badgeNumber.toUpperCase().trim(),
        role: normalizedRole,
        department,
        station,
        designation,
        
      },
      select: SAFE_USER_SELECT,
    });

    logger.info('USER_SERVICE', `New user created successfully: ${newUser.name} [${newUser.role}] (${newUser.badgeNumber})`);
    return newUser;
  }

  static async updateUser(id, updateData) {
    const existingUser = await prisma.user.findUnique({
      where: { id },
    });

    if (!existingUser) {
      throw new Error(`User with ID "${id}" was not found.`);
    }

    const dataToUpdate = {};

    if (updateData.email && updateData.email.toLowerCase() !== existingUser.email.toLowerCase()) {
      const emailTaken = await prisma.user.findFirst({
        where: {
          email: { equals: updateData.email.trim(), mode: 'insensitive' },
          id: { not: id },
        },
      });
      if (emailTaken) {
        throw new Error(`Email "${updateData.email}" is already in use by another user.`);
      }
      dataToUpdate.email = updateData.email.toLowerCase().trim();
    }

    if (updateData.badgeNumber && updateData.badgeNumber.toUpperCase() !== existingUser.badgeNumber.toUpperCase()) {
      const badgeTaken = await prisma.user.findFirst({
        where: {
          badgeNumber: { equals: updateData.badgeNumber.trim(), mode: 'insensitive' },
          id: { not: id },
        },
      });
      if (badgeTaken) {
        throw new Error(`Badge number "${updateData.badgeNumber}" is already in use by another user.`);
      }
      dataToUpdate.badgeNumber = updateData.badgeNumber.toUpperCase().trim();
    }

    if (updateData.name) dataToUpdate.name = updateData.name.trim();

    if (updateData.role) {
      const normalizedRole = updateData.role === 'STATION_HOUSE_OFFICER' ? 'STATION_IN_CHARGE' : (updateData.role === 'PUBLIC_PROSECUTOR' ? 'PROSECUTOR' : (updateData.role === 'JUDICIAL_OFFICER' ? 'COURT_CLERK_JUDGE' : updateData.role));
      if (!VALID_ROLES.includes(normalizedRole)) {
        throw new Error(`Invalid role "${updateData.role}". Allowed roles: ${VALID_ROLES.join(', ')}`);
      }
      dataToUpdate.role = normalizedRole;
    }

    if (updateData.department) dataToUpdate.department = updateData.department.trim();
    if (updateData.station) dataToUpdate.station = updateData.station.trim();
    if (updateData.designation) dataToUpdate.designation = updateData.designation.trim();

    if (updateData.password) {
      dataToUpdate.passwordHash = bcrypt.hashSync(updateData.password, 10);
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: dataToUpdate,
      select: SAFE_USER_SELECT,
    });

    logger.info('USER_SERVICE', `User updated successfully: ${updatedUser.name} (${updatedUser.id})`);
    return updatedUser;
  }

  static async deleteUser(id) {
    const existingUser = await prisma.user.findUnique({
      where: { id },
    });

    if (!existingUser) {
      throw new Error(`User with ID "${id}" was not found.`);
    }

    const deletedUser = await prisma.user.delete({
      where: { id },
      select: SAFE_USER_SELECT,
    });

    logger.info('USER_SERVICE', `User deleted: ${deletedUser.name} (${deletedUser.badgeNumber})`);
    return deletedUser;
  }
}

