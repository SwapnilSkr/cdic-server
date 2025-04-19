import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';

export enum UserRole {
  ADMIN = 'admin',
  MEMBER = 'member'
}

export interface IUser extends Document {
  email: string;
  password: string;
  name: string;
  role: UserRole;
  blockedAccounts: { platform: string, identifier: string }[];
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const userSchema = new Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  name: { type: String, required: true },
  role: { type: String, enum: Object.values(UserRole), default: UserRole.MEMBER },
  blockedAccounts: { 
    type: [{ 
      platform: { type: String, required: true },
      identifier: { type: String, required: true }
    }], 
    default: [] 
  }
}, { timestamps: true });

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

export const User = mongoose.model<IUser>('User', userSchema);
