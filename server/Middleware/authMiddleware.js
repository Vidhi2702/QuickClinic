import { verifyAccessToken } from '../services/tokenService.js';
import  User  from '../models/Users/User.js'
import Patient from '../models/Users/Patient.js';
import Admin from '../models/Users/Admin.js';
import Doctor from '../models/Users/Doctor.js';
export const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const decoded = verifyAccessToken(token);
    const user = await User.findById(decoded.userId).select('-password -refreshToken');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Get profile based on role
    let profile;
    switch(user.role) {
      case 'admin':
        profile = await Admin.findOne({ userId: user._id });
        break;
      case 'doctor':
        profile = await Doctor.findOne({ userId: user._id });
        break;
      case 'patient':
        profile = await Patient.findOne({ userId: user._id });
        break;
    }

    if (!profile) {
      return res.status(404).json({ message: 'Profile not found' });
    }

    req.user = {
      ...user.toObject(),
      userId: user._id,
      profileId: profile._id, // Add the profile ID
      role: user.role
    };
    next();
  } catch (error) {
    res.status(403).json({ message: 'Invalid or expired token' });
  }
};

export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Unauthorized access' });
    }
    next();
  };
};