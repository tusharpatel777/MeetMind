import { dbStore } from './dbStore';
import { IMeeting } from '../models/types';

export class CalendarService {
  private static getOAuthCredentials() {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5000/api/calendar/callback';
    
    if (!clientId || !clientSecret) {
      return null;
    }
    return { clientId, clientSecret, redirectUri };
  }

  /**
   * Get the Google OAuth Authorization URL
   */
  public static getAuthUrl(): string {
    const creds = this.getOAuthCredentials();
    if (!creds) {
      // Mock authorization link for demo sandbox testing
      return 'http://localhost:5000/api/calendar/callback?code=mock_oauth_code_123';
    }

    const rootUrl = 'https://accounts.google.com/o/oauth2/v2/auth';
    const options = {
      redirect_uri: creds.redirectUri,
      client_id: creds.clientId,
      access_type: 'offline',
      response_type: 'code',
      prompt: 'consent',
      scope: [
        'https://www.googleapis.com/auth/calendar.events',
        'https://www.googleapis.com/auth/calendar.readonly'
      ].join(' ')
    };

    const qs = new URLSearchParams(options);
    return `${rootUrl}?${qs.toString()}`;
  }

  /**
   * Exchange code for Google Access & Refresh Tokens
   */
  public static async getTokensFromCode(code: string): Promise<any> {
    const creds = this.getOAuthCredentials();
    if (!creds || code === 'mock_oauth_code_123') {
      console.log('📅 Simulating Google OAuth token exchange');
      return {
        access_token: 'mock_access_token_xyz_987',
        refresh_token: 'mock_refresh_token_abc_123',
        expiry_date: Date.now() + 3600 * 1000
      };
    }

    try {
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: creds.clientId,
          client_secret: creds.clientSecret,
          redirect_uri: creds.redirectUri,
          grant_type: 'authorization_code'
        })
      });

      if (!response.ok) {
        throw new Error('Failed to exchange auth code');
      }

      return await response.json();
    } catch (err: any) {
      console.error('Google OAuth token exchange failed:', err.message);
      throw err;
    }
  }

  /**
   * Create Google Calendar Event and return event ID and Meet Link
   */
  public static async createEvent(meeting: IMeeting, userTokens: any): Promise<{ calendarEventId: string; meetLink: string }> {
    const creds = this.getOAuthCredentials();
    
    if (!creds || !userTokens || userTokens.access_token === 'mock_access_token_xyz_987') {
      console.log('📅 Mocking Google Calendar Event creation');
      return {
        calendarEventId: 'mock_cal_event_' + Math.random().toString(36).substring(7),
        meetLink: 'https://meet.google.com/abc-defg-hij'
      };
    }

    try {
      // Build Google Calendar Event Payload
      const eventPayload = {
        summary: meeting.title,
        description: meeting.description || 'MeetMind Scheduled Meeting Workspace.',
        start: { dateTime: new Date(meeting.startTime).toISOString() },
        end: { dateTime: new Date(meeting.endTime).toISOString() },
        attendees: meeting.participants.map(email => ({ email })),
        conferenceData: {
          createRequest: {
            requestId: 'meetmind_' + meeting._id,
            conferenceSolutionKey: { type: 'hangoutsMeet' }
          }
        }
      };

      const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${userTokens.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(eventPayload)
      });

      if (!response.ok) {
        throw new Error('Google Calendar event creation failed.');
      }

      const eventData = (await response.json()) as any;
      
      // Extract Google Meet Link if generated
      const meetLink = eventData.conferenceData?.entryPoints?.find((ep: any) => ep.entryPointType === 'video')?.uri 
        || 'https://meet.google.com/abc-defg-hij';

      return {
        calendarEventId: eventData.id,
        meetLink
      };
    } catch (err: any) {
      console.error('Failed to create real Google Calendar Event, falling back to mock. Error:', err.message);
      return {
        calendarEventId: 'mock_cal_event_' + Math.random().toString(36).substring(7),
        meetLink: 'https://meet.google.com/abc-defg-hij'
      };
    }
  }

  /**
   * Delete Google Calendar Event
   */
  public static async deleteEvent(calendarEventId: string, userTokens: any): Promise<boolean> {
    const creds = this.getOAuthCredentials();
    if (!creds || !userTokens || calendarEventId.startsWith('mock_')) {
      console.log('📅 Simulating Google Calendar Event deletion');
      return true;
    }

    try {
      const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${calendarEventId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${userTokens.access_token}` }
      });
      return response.ok;
    } catch (err: any) {
      console.error('Failed to delete Google Calendar Event:', err.message);
      return false;
    }
  }
}
