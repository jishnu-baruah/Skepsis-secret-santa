// models/UnassignedNames.ts
import mongoose from 'mongoose';

const UnassignedNamesSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  drive_link: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  }
});

export default mongoose.models.UnassignedNames || 
  mongoose.model('UnassignedNames', UnassignedNamesSchema);