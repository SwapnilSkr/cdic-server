import { Request, Response } from 'express';
import * as userService from '../services/user.service';
import * as auditService from '../services/audit.service';
import { User } from '../models/user.model';

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

export const updateBlockedAccounts = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id; 
    const { blockedAccounts } = req.body; // Expecting an array of { platform: string, identifier: string }

    if (!userId) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    if (!Array.isArray(blockedAccounts)) {
       return res.status(400).json({ message: 'blockedAccounts must be an array' });
    }

    // Basic validation for each item in the array
    for (const account of blockedAccounts) {
      if (!account || typeof account.platform !== 'string' || typeof account.identifier !== 'string') {
        return res.status(400).json({ message: 'Each item in blockedAccounts must have a platform and identifier (both strings)' });
      }
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId, 
      { $set: { blockedAccounts: blockedAccounts } }, 
      { new: true } // Return the updated document
    ).select('-password'); // Exclude password from the returned user object

    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    await auditService.createAudit({
      userId,
      action: "Blocked Accounts Update",
      actionType: "profile"
    });

    res.status(200).json({ 
      message: 'Blocked accounts updated successfully', 
      blockedAccounts: updatedUser.blockedAccounts 
    });

  } catch (error: any) {
    console.error("Error updating blocked accounts:", error);
    res.status(500).json({ message: error.message || 'Failed to update blocked accounts' });
  }
};

export const getBlockedAccounts = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    const user = await User.findById(userId).select('blockedAccounts').lean();
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json({ blockedAccounts: user.blockedAccounts || [] });

  } catch (error: any) {
    console.error("Error fetching blocked accounts:", error);
    res.status(500).json({ message: error.message || 'Failed to fetch blocked accounts' });
  }
};

export const removeBlockedAccount = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { platform, identifier } = req.body; // Expect platform and identifier in body

    if (!userId) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    if (!platform || !identifier) {
      return res.status(400).json({ message: 'Platform and identifier are required to remove a block.' });
    }

    // Use $pull to remove the matching element from the array
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { 
        $pull: { 
          blockedAccounts: { platform: platform, identifier: identifier } 
        } 
      },
      { new: true } // Return the updated document
    ).select('blockedAccounts'); // Only include the blockedAccounts field

    if (!updatedUser) {
      // This could mean user not found, or the account wasn't in the list
      // Check if user exists to differentiate
      const userExists = await User.exists({ _id: userId });
      if (!userExists) {
          return res.status(404).json({ message: 'User not found' });
      }
      // If user exists, it means the account wasn't blocked, which is fine
      // Optionally return the current list if the specified account wasn't found
      const currentUser = await User.findById(userId).select('blockedAccounts').lean();
       return res.status(200).json({ 
        message: 'Account was not found in the blocklist.', 
        blockedAccounts: currentUser?.blockedAccounts || []
      });
    }

    await auditService.createAudit({
      userId,
      action: "Blocked Account Removed",
      actionType: "profile"
    });

    res.status(200).json({ 
      message: 'Blocked account removed successfully', 
      blockedAccounts: updatedUser.blockedAccounts 
    });

  } catch (error: any) {
    console.error("Error removing blocked account:", error);
    res.status(500).json({ message: error.message || 'Failed to remove blocked account' });
  }
}; 