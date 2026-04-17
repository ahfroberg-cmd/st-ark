import { supabase } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    // Testa att hämta tabellerna
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('count', { count: 'exact', head: true })

    const { data: placements, error: placementsError } = await supabase
      .from('placements')
      .select('count', { count: 'exact', head: true })

    const { data: courses, error: coursesError } = await supabase
      .from('courses')
      .select('count', { count: 'exact', head: true })

    if (profilesError || placementsError || coursesError) {
      return NextResponse.json({
        success: false,
        errors: {
          profiles: profilesError?.message,
          placements: placementsError?.message,
          courses: coursesError?.message
        }
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Supabase anslutning fungerar!',
      tables: {
        profiles: profiles,
        placements: placements,
        courses: courses
      }
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Okänt fel'
    }, { status: 500 })
  }
}
