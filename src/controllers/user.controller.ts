import { Request, Response } from 'express';
import * as userService from '../services/user.service';
import * as auditService from '../services/audit.service';

export const registerUser = async (req: Request, res: Response) => {
  try {
    const { email, password, name, role } = req.body;

    // Validate required fields
    if (!email || !password || !name) {
       res.status(400).json({ 
        message: 'Email, password, and name are required' 
      });
      return;
    }

    const result = await userService.register({ 
      email, 
      password, 
      name, 
      role 
    });

    await auditService.createAudit({
      userId: result.user._id as string,
      action: "User Registration",
      actionType: "profile"
    });

    res.status(201).json(result);
  } catch (error: any) {
    console.log(error);
    res.status(400).json({ 
      message: error.message || 'Registration failed' 
    });
  }
};

export const loginUser = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({
        message: 'Email and password are required'
      });
      return;
    }

    const result = await userService.login(email, password);

    await auditService.createAudit({
      userId: result.user._id as string,
      action: "User Login",
      actionType: "profile"
    });

    res.status(200).json(result);
  } catch (error: any) {
    res.status(401).json({
      message: error.message || 'Login failed'
    });
  }
};

export const updateUserProfile = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id; // From auth middleware
    const { name, email } = req.body;

    if (!userId) {
      res.status(401).json({
        message: 'User not authenticated'
      });
      return;
    }

    const result = await userService.updateUser(userId, { name, email });

    await auditService.createAudit({
      userId,
      action: "Profile Update",
      actionType: "profile"
    });

    res.status(200).json(result);
  } catch (error: any) {
    res.status(400).json({
      message: error.message || 'Failed to update profile'
    });
  }
};

export const updateUserPassword = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id; // From auth middleware
    const { currentPassword, newPassword } = req.body;

    if (!userId) {
      res.status(401).json({
        message: 'User not authenticated'
      });
      return;
    }

    const result = await userService.updatePassword(userId, {
      currentPassword,
      newPassword
    });

    await auditService.createAudit({
      userId,
      action: "Password Change",
      actionType: "profile"
    });

    res.status(200).json(result);
  } catch (error: any) {
    res.status(400).json({
      message: error.message || 'Failed to update password'
    });
  }
};

export const getAllUsers = async (req: Request, res: Response) => {
  try {
    const users = await userService.getAllUsers();
    res.status(200).json(users);
  } catch (error: any) {
    res.status(500).json({
      message: error.message || 'Failed to fetch users'
    });
  }
};

export const updateUser = async (req: Request, res: Response) => {
  try {
    const loggedInUserId = req.user?.id;
    if (!loggedInUserId) {
      res.status(401).json({
        message: 'User not authenticated'
      });
      return;
    }

    const { userId, newRole, name } = req.body;
    const updatedUser = await userService.updateUserRole({ userId, newRole, name });

    await auditService.createAudit({
      userId: loggedInUserId,
      action: "Role Update",
      actionType: "profile"
    });

    res.status(200).json(updatedUser);
  } catch (error: any) {
    console.log(error);
    res.status(400).json({
      message: error.message || 'Failed to update user role'
    });
  }
};

export const deleteUser = async (req: Request, res: Response) => {
  try {
    const loggedInUserId = req.user?.id;
    if (!loggedInUserId) {
      res.status(401).json({
        message: 'User not authenticated'
      });
      return;
    }
    const { userId } = req.params;
    await userService.deleteUser(userId);

    await auditService.createAudit({
      userId: loggedInUserId,
      action: "User Deletion",
      actionType: "profile"
    });

    res.status(200).json({ message: 'User deleted successfully' });
  } catch (error: any) {
    res.status(400).json({
      message: error.message || 'Failed to delete user'
    });
  }
}; 