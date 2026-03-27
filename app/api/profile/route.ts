import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface ProfileUpdateRequest {
  fullName?: string;
  collegeName?: string;
  phone?: string;
  skills?: string[];
}

export async function GET() {
  try {
    const supabase = await createClient();

    // Get the current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Fetch the user's profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError && profileError.code !== 'PGRST116') {
      console.error('Error fetching profile:', profileError);
      return NextResponse.json(
        { error: 'Failed to fetch profile' },
        { status: 500 }
      );
    }

    // If profile doesn't exist, return default structure
    if (!profile) {
      const defaultProfile = {
        id: user.id,
        fullName: user.user_metadata?.full_name || '',
        email: user.email || '',
        collegeName: '',
        phone: '',
        skills: [],
        avatarUrl: user.user_metadata?.avatar_url || null,
        createdAt: null,
        updatedAt: null
      };
      return NextResponse.json(defaultProfile);
    }

    // Return the profile data (profile is guaranteed to exist here)
    return NextResponse.json({
      id: (profile as any).id,
      fullName: (profile as any).full_name || '',
      email: (profile as any).email || '',
      collegeName: (profile as any).college_name || '',
      phone: (profile as any).phone || '',
      skills: (profile as any).skills || [],
      avatarUrl: (profile as any).avatar_url || null,
      createdAt: (profile as any).created_at,
      updatedAt: (profile as any).updated_at
    });

  } catch (error) {
    console.error('Unexpected error in GET /api/profile:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get the current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse the request body
    const body: ProfileUpdateRequest = await request.json();
    const { fullName, collegeName, phone, skills } = body;

    // Validate input
    if (fullName !== undefined && typeof fullName !== 'string') {
      return NextResponse.json(
        { error: 'fullName must be a string' },
        { status: 400 }
      );
    }

    if (collegeName !== undefined && typeof collegeName !== 'string') {
      return NextResponse.json(
        { error: 'collegeName must be a string' },
        { status: 400 }
      );
    }

    if (phone !== undefined && typeof phone !== 'string') {
      return NextResponse.json(
        { error: 'phone must be a string' },
        { status: 400 }
      );
    }

    if (skills !== undefined && !Array.isArray(skills)) {
      return NextResponse.json(
        { error: 'skills must be an array' },
        { status: 400 }
      );
    }

    // Prepare update data
    const updateData: {
      full_name?: string;
      college_name?: string;
      phone?: string;
      skills?: string[];
      updated_at: string;
    } = {
      updated_at: new Date().toISOString()
    };

    if (fullName !== undefined) updateData.full_name = fullName;
    if (collegeName !== undefined) updateData.college_name = collegeName;
    if (phone !== undefined) updateData.phone = phone;
    if (skills !== undefined) updateData.skills = skills;

    // Check if profile exists
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', user.id)
      .single();

    let result;

    if (existingProfile) {
      // Update existing profile
      const { data, error } = await (supabase as any)
        .from('profiles')
        .update(updateData)
        .eq('id', user.id)
        .select()
        .single();

      if (error) {
        console.error('Error updating profile:', error);
        return NextResponse.json(
          { error: 'Failed to update profile' },
          { status: 500 }
        );
      }

      result = data;
    } else {
      // Create new profile
      const { data, error } = await (supabase as any)
        .from('profiles')
        .insert({
          id: user.id,
          email: user.email,
          ...updateData
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating profile:', error);
        return NextResponse.json(
          { error: 'Failed to create profile' },
          { status: 500 }
        );
      }

      result = data;
    }

    // Return the updated profile
    return NextResponse.json({
      id: result.id,
      fullName: result.full_name || '',
      email: result.email || '',
      collegeName: result.college_name || '',
      phone: result.phone || '',
      skills: result.skills || [],
      avatarUrl: result.avatar_url || null,
      createdAt: result.created_at,
      updatedAt: result.updated_at
    });

  } catch (error) {
    console.error('Unexpected error in PUT /api/profile:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}