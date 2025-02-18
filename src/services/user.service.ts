import { User, UserRole } from '../models/user.model';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../middlewares/auth.middleware';

interface RegisterData {
  email: string;
  password: string;
  name: string;
  role?: UserRole;
}

interface UpdateUserData {
  name?: string;
  email?: string;
}

interface UpdatePasswordData {
  currentPassword: string;
  newPassword: string;
}

interface RoleUpdateData {
  userId: string;
  newRole: UserRole;
  name: string;
}

export const register = async (userData: RegisterData) => {
  // Check if user already exists
  const existingUser = await User.findOne({ email: userData.email });
  if (existingUser) {
    throw new Error('User already exists');
  }

  // Create new user
  const user = new User({
    email: userData.email,
    password: userData.password,
    name: userData.name,
    role: userData.role || UserRole.MEMBER
  });

  await user.save();

  // Return user data (excluding password) without token
  const { password, ...userObject } = user.toObject();

  return {
    user: userObject
  };
};

export const login = async (email: string, password: string) => {
  // Find user by email
  const user = await User.findOne({ email });
  if (!user) {
    throw new Error('Invalid credentials');
  }

  // Compare password
  const isValidPassword = await user.comparePassword(password);
  if (!isValidPassword) {
    throw new Error('Invalid credentials');
  }

  // Generate JWT token only during login
  const token = jwt.sign({ id: user._id }, JWT_SECRET, {
    expiresIn: '24h'
  });

  // Return user data (excluding password) and token
  const userObject = user.toObject();
  const { password: _, ...userObjectWithoutPassword } = userObject;

  return {
    user: userObjectWithoutPassword,
    token
  };
};

export const updateUser = async (userId: string, userData: UpdateUserData) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error('User not found');
  }

  // Check if email is being updated and if it's already taken
  if (userData.email && userData.email !== user.email) {
    const existingUser = await User.findOne({ email: userData.email });
    if (existingUser) {
      throw new Error('Email already in use');
    }
  }

  // Update user
  Object.assign(user, userData);
  await user.save();

  // Return user data without password
  const userObject = user.toObject();
  const { password, ...userObjectWithoutPassword } = userObject;

  return { user: userObjectWithoutPassword };
};

export const updatePassword = async (userId: string, passwordData: UpdatePasswordData) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error('User not found');
  }

  // Verify current password
  const isValidPassword = await user.comparePassword(passwordData.currentPassword);
  if (!isValidPassword) {
    throw new Error('Current password is incorrect');
  }

  // Update password
  user.password = passwordData.newPassword;
  await user.save();

  return { message: 'Password updated successfully' };
};

export const getAllUsers = async () => {
  const users = await User.find({}, '-password');
  return users;
};

export const updateUserRole = async ({ userId, newRole, name }: RoleUpdateData) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error('User not found');
  }

  console.log(newRole, name);

  user.role = newRole;
  user.name = name;
  await user.save();

  const userObject = user.toObject();
  const { password, ...userObjectWithoutPassword } = userObject;
  return userObjectWithoutPassword;
};

export const registerNewMember = async (userData: RegisterData) => {
  // Check if user already exists
  const existingUser = await User.findOne({ email: userData.email });
  if (existingUser) {
    throw new Error('User already exists');
  }

  // Create new user with MEMBER role
  const user = new User({
    ...userData,
    role: userData.role || UserRole.MEMBER
  });

  await user.save();

  const userObject = user.toObject();
  const { password, ...userObjectWithoutPassword } = userObject;
  return userObjectWithoutPassword;
};

export const deleteUser = async (userId: string) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error('User not found');
  }

  await User.deleteOne({ _id: userId });
  return { message: 'User deleted successfully' };
}; 