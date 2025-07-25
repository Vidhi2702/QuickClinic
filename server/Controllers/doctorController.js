import Doctor from '../models/Users/Doctor.js';
import { uploadToCloudinary } from '../services/uploadService.js';
import mongoose from 'mongoose';

// Create a doctor profile
export const createDoctorProfile = async (req, res) => {
  try {
    const { userId } = req.user;
    const doctorData = req.body;

    // Validate user ID
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid user ID format' });
    }

    // Check if profile already exists
    const existingProfile = await Doctor.findOne({ userId });
    if (existingProfile) {
      return res.status(409).json({ message: 'Doctor profile already exists' });
    }

    // Validate required fields
    if (!doctorData.specialization || !doctorData.qualifications) {
      return res.status(400).json({ 
        message: 'Specialization and qualifications are required',
        errors: {
          specialization: !doctorData.specialization ? 'Specialization is required' : undefined,
          qualifications: !doctorData.qualifications ? 'Qualifications are required' : undefined
        }
      });
    }

    // Handle profile picture upload
    if (req.file) {
      try {
        const result = await uploadToCloudinary(req.file.path);
        doctorData.profilePicture = result.url;
      } catch (uploadError) {
        console.error('Upload error:', uploadError);
        return res.status(500).json({ message: 'Failed to upload profile picture' });
      }
    }

    // Create doctor profile linked to user
    const doctor = new Doctor({
      userId,
      ...doctorData
    });

    await doctor.save();
    
    res.status(201).json({
      message: 'Doctor profile created successfully',
      doctor: doctor.toObject({ getters: true })
    });
  } catch (error) {
    console.error('Error creating doctor profile:', error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ message: 'Validation error', errors });
    }
    
    res.status(500).json({ 
      message: 'Failed to create doctor profile',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Update a doctor profile
export const updateDoctorProfile = async (req, res) => {
  try {
    const { userId } = req.user;
    const updates = req.body;

    if (!updates || Object.keys(updates).length === 0 && !req.file) {
      return res.status(400).json({ message: 'No updates provided' });
    }

    // Handle profile picture update
    if (req.file) {
      try {
        const result = await uploadToCloudinary(req.file.path);
        updates.profilePicture = result.url;
      } catch (uploadError) {
        console.error('Upload error:', uploadError);
        return res.status(500).json({ message: 'Failed to upload profile picture' });
      }
    }

    const doctor = await Doctor.findOneAndUpdate(
      { userId },
      updates,
      { 
        new: true,
        runValidators: true // Ensure updates are validated
      }
    ).select('-__v'); // Remove version key

    if (!doctor) {
      return res.status(404).json({ message: 'Doctor profile not found' });
    }

    res.json({
      message: 'Doctor profile updated successfully',
      doctor: doctor.toObject({ getters: true })
    });
  } catch (error) {
    console.error('Error updating doctor profile:', error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ message: 'Validation error', errors });
    }
    
    res.status(500).json({ 
      message: 'Failed to update doctor profile',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get doctor profile
export const getDoctorProfile = async (req, res) => {
  try {
    const { userId } = req.user;
    
    // First check if doctor exists without populating
    const doctorExists = await Doctor.exists({ userId });
    if (!doctorExists) {
      return res.status(404).json({ message: 'Doctor profile not found' });
    }

    // Only populate fields that have data
    const doctor = await Doctor.findOne({ userId }).lean();
    
    const populateOptions = [];
    
    if (doctor.clinicId) {
      populateOptions.push({ path: 'clinicId', select: 'name address contactInfo' });
    }
    
    if (doctor.appointments && doctor.appointments.length > 0) {
      populateOptions.push({ 
        path: 'appointments',
        select: '-__v',
        populate: {
          path: 'patientId',
          select: 'name profilePicture'
        }
      });
    }
    
    let populatedDoctor = doctor;
    if (populateOptions.length > 0) {
      populatedDoctor = await Doctor.findOne({ userId })
        .populate(populateOptions)
        .lean();
    }

    // Remove sensitive or unnecessary fields
    delete populatedDoctor.__v;
    
    res.json(populatedDoctor);
  } catch (error) {
    console.error('Error fetching doctor profile:', error);
    res.status(500).json({ 
      message: 'Failed to fetch doctor profile',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get all doctors by clinic
export const getDoctorsByClinic = async (req, res) => {
  try {
    const { clinicId } = req.params;

    // Validate clinic ID
    if (!mongoose.Types.ObjectId.isValid(clinicId)) {
      return res.status(400).json({ message: 'Invalid clinic ID format' });
    }

    const doctors = await Doctor.find({ clinicId })
      .select('-appointments -ratings -__v')
      .populate('clinicId', 'name location')
      .lean();

    if (!doctors || doctors.length === 0) {
      return res.status(404).json({ 
        message: 'No doctors found for this clinic',
        suggestions: 'Check if the clinic ID is correct'
      });
    }

    res.json({
      count: doctors.length,
      doctors
    });
  } catch (error) {
    console.error('Error fetching doctors by clinic:', error);
    res.status(500).json({ 
      message: 'Failed to fetch doctors',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};