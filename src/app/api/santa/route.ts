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

      // Get available names from MongoDB
      const availableNames = await UnassignedNames.find({
        name: { $ne: name.toLowerCase() }
      });

      if (availableNames.length === 0) {
        return NextResponse.json(
          { error: 'No suitable names available' },
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
              name,
              email: email.toLowerCase(),
              password
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

          // Remove the assigned person from available names
          await UnassignedNames.findByIdAndDelete(selectedPerson._id, { session });
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