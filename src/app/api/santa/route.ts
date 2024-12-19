// app/api/santa/route.ts
import { NextResponse } from 'next/server';
import connectToMongoDB from '@/lib/mongodb';
import SecretSanta from '@/models/SecretSanta';
import UnassignedNames from '@/models/UnassignedNames'; 

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password, name, action = 'check' } = body;

    // Basic validation
    if (!email?.trim() || !password?.trim()) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Connect to MongoDB
    await connectToMongoDB();

    // Check if user exists
    const existingUser = await SecretSanta.findOne({
      'user.email': email.toLowerCase(),
      'user.password': password
    });

    // If checking existing assignment
    if (action === 'check') {
      if (!existingUser) {
        return NextResponse.json(
          { error: 'Invalid email or password' },
          { status: 401 }
        );
      }

      return NextResponse.json({
        name: existingUser.assignedPerson.name,
        description: existingUser.assignedPerson.description,
        driveLink: existingUser.assignedPerson.drive_link
      });
    }

    // If creating new assignment
    if (action === 'create') {
      // Validate name for new assignment
      if (!name?.trim()) {
        return NextResponse.json(
          { error: 'Name is required for new assignment' },
          { status: 400 }
        );
      }

      if (existingUser) {
        return NextResponse.json(
          { error: 'This email has already been assigned a person' },
          { status: 400 }
        );
      }

      // Check if the registering person exists in UnassignedNames with matching name AND email
      const registeringPerson = await UnassignedNames.findOne({
        $and: [
          { name: { $regex: new RegExp(`^${name.trim()}$`, 'i') } }, // Case-insensitive exact name match
          { email: email.toLowerCase() } // Exact email match (case-insensitive)
        ]
      });

      if (!registeringPerson) {
        // Check if either name or email exists separately to give more specific error message
        const nameExists = await UnassignedNames.findOne({
          name: { $regex: new RegExp(`^${name.trim()}$`, 'i') }
        });
        const emailExists = await UnassignedNames.findOne({
          email: email.toLowerCase()
        });

        if (nameExists) {
          return NextResponse.json(
            { error: 'This name is registered with a different email address' },
            { status: 403 }
          );
        } else if (emailExists) {
          return NextResponse.json(
            { error: 'This email is registered with a different name' },
            { status: 403 }
          );
        } else {
          return NextResponse.json(
            { error: 'Your name and email combination was not found in the Secret Santa list. Please check your details or contact the organizer.' },
            { status: 403 }
          );
        }
      }

      // Get available names from MongoDB but exclude their own name and anyone already assigned
      const availableNames = await UnassignedNames.find({
        _id: { $ne: registeringPerson._id },
        name: { $nin: await getAssignedNames() }
      });

      if (availableNames.length === 0) {
        return NextResponse.json(
          { error: 'No suitable names available for assignment' },
          { status: 404 }
        );
      }

      // Select a random person
      const randomIndex = Math.floor(Math.random() * availableNames.length);
      const selectedPerson = availableNames[randomIndex];

      // Start a MongoDB session for transaction
      const session = await SecretSanta.startSession();
      
      try {
        await session.withTransaction(async () => {
          // Create new assignment
          const newAssignment = new SecretSanta({
            user: {
              name: registeringPerson.name, // Use the exact name from the database
              email: registeringPerson.email.toLowerCase(),
              password,
              drive_link: registeringPerson.drive_link,
              description: registeringPerson.description
            },
            assignedPerson: {
              name: selectedPerson.name,
              email: selectedPerson.email,
              drive_link: selectedPerson.drive_link,
              description: selectedPerson.description
            }
          });

          // Save assignment
          await newAssignment.save({ session });
        });

        return NextResponse.json({
          name: selectedPerson.name,
          description: selectedPerson.description,
          driveLink: selectedPerson.drive_link
        });
      } catch (error) {
        console.error('Transaction failed:', error);
        return NextResponse.json(
          { error: 'Failed to save assignment' },
          { status: 500 }
        );
      } finally {
        await session.endSession();
      }
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );

  } catch (error) {
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

// Helper function to get list of names that have already been assigned to someone
async function getAssignedNames(): Promise<string[]> {
  const assignments = await SecretSanta.find({}, 'assignedPerson.name');
  return assignments.map(assignment => assignment.assignedPerson.name);
}