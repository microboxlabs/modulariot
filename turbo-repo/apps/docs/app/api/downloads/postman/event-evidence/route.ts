import { NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'

export async function GET() {
  try {
    const filePath = join(process.cwd(), 'public', 'collections', 'event-evidence-postman-collection.json')
    const fileContent = await readFile(filePath, 'utf-8')

    return new NextResponse(fileContent, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': 'attachment; filename="event-evidence-postman-collection.json"',
        'Cache-Control': 'public, max-age=3600',
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'File not found' },
      { status: 404 }
    )
  }
}
