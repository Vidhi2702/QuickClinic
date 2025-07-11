import Prescription from '../models/Appointment/Prescription.js';
import Appointment from '../models/Appointment/Appointment.js';
import mongoose from 'mongoose';

// Create prescription for an appointment
export const createPrescription = async (req, res) => {
  try {
    const { userId } = req.user;
    const { appointmentId } = req.params;
    const { diagnosis, medications, tests, notes, followUpDate } = req.body;

    // Validate required fields
    if (!appointmentId || !medications || medications.length === 0) {
      return res.status(400).json({ 
        message: 'Appointment ID and medications are required',
        errors: {
          appointmentId: !appointmentId ? 'Appointment ID is required' : undefined,
          medications: !medications || medications.length === 0 ? 'At least one medication is required' : undefined
        }
      });
    }

    // Validate appointment exists and belongs to this doctor
    const appointment = await Appointment.findOne({
      _id: appointmentId,
      doctorId: userId
    });

    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found or not authorized' });
    }

    // Validate medications structure
    const medicationErrors = [];
    medications.forEach((med, index) => {
      if (!med.name || !med.dosage || !med.frequency || !med.duration) {
        medicationErrors.push(`Medication ${index + 1} is missing required fields`);
      }
    });

    if (medicationErrors.length > 0) {
      return res.status(400).json({ 
        message: 'Medication validation failed',
        errors: medicationErrors
      });
    }

    // Create prescription
    const prescription = new Prescription({
      appointmentId,
      doctorId: userId,
      patientId: appointment.patientId,
      diagnosis,
      medications,
      tests,
      notes,
      followUpDate: followUpDate ? new Date(followUpDate) : undefined
    });

    await prescription.save();

    // Update appointment with prescription reference
    appointment.prescriptionId = prescription._id;
    await appointment.save();

    res.status(201).json({
      message: 'Prescription created successfully',
      prescription: prescription.toObject({ getters: true })
    });

  } catch (error) {
    console.error('Error creating prescription:', error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ message: 'Validation error', errors });
    }
    
    res.status(500).json({ 
      message: 'Failed to create prescription',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get prescriptions for patient
export const getPatientPrescriptions = async (req, res) => {
  try {
    const { userId } = req.user;

    const prescriptions = await Prescription.find({ patientId: userId })
      .populate('doctorId', 'name specialization')
      .populate('appointmentId', 'date')
      .sort({ date: -1 })
      .lean();

    res.json({
      count: prescriptions.length,
      prescriptions
    });
  } catch (error) {
    console.error('Error fetching patient prescriptions:', error);
    res.status(500).json({ 
      message: 'Failed to fetch prescriptions',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get prescriptions created by doctor
export const getDoctorPrescriptions = async (req, res) => {
  try {
    const { userId } = req.user;
    const { patientId } = req.query;

    const query = { doctorId: userId };
    if (patientId) {
      query.patientId = patientId;
    }

    const prescriptions = await Prescription.find(query)
      .populate('patientId', 'name')
      .populate('appointmentId', 'date')
      .sort({ date: -1 })
      .lean();

    res.json({
      count: prescriptions.length,
      prescriptions
    });
  } catch (error) {
    console.error('Error fetching doctor prescriptions:', error);
    res.status(500).json({ 
      message: 'Failed to fetch prescriptions',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get single prescription
export const getPrescription = async (req, res) => {
  try {
    const { prescriptionId } = req.params;

    const prescription = await Prescription.findById(prescriptionId)
      .populate('doctorId', 'name specialization licenseNumber')
      .populate('patientId', 'name dateOfBirth gender')
      .populate('appointmentId', 'date reason')
      .lean();

    if (!prescription) {
      return res.status(404).json({ message: 'Prescription not found' });
    }

    res.json(prescription);
  } catch (error) {
    console.error('Error fetching prescription:', error);
    res.status(500).json({ 
      message: 'Failed to fetch prescription',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};