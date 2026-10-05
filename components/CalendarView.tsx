'use client'

import { useState } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import listPlugin from '@fullcalendar/list'
import type { Event } from '@/types'
import EventDetailModal from './EventDetailModal'

type Props = {
  events: Event[]
  onDateClick: (date: string) => void
  onEventUpdated: () => void
}

const ARTIST_COLORS = [
  '#ec4899', '#8b5cf6', '#3b82f6', '#10b981',
  '#f59e0b', '#ef4444', '#06b6d4', '#84cc16',
]

export default function CalendarView({ events, onDateClick, onEventUpdated }: Props) {
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null)

  const artistColorMap = new Map<string, string>()
  events.forEach(e => {
    if (!artistColorMap.has(e.artist_id)) {
      artistColorMap.set(e.artist_id, ARTIST_COLORS[artistColorMap.size % ARTIST_COLORS.length])
    }
  })

  const calendarEvents = events.map(e => ({
    id: e.id,
    title: `${e.artist?.name ?? ''} ${e.title}`,
    start: e.start_date,
    end: e.end_date ?? undefined,
    backgroundColor: artistColorMap.get(e.artist_id),
    borderColor: artistColorMap.get(e.artist_id),
    extendedProps: { event: e },
  }))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleEventClick = (info: any) => {
    setSelectedEvent(info.event.extendedProps.event as Event)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleDateClick = (info: any) => {
    onDateClick(info.dateStr as string)
  }

  return (
    <>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4">
          <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin]}
          initialView="dayGridMonth"
          locale="ja"
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,listMonth',
          }}
          buttonText={{
            today: '今日',
            month: '月',
            week: '週',
            list: 'リスト',
          }}
          events={calendarEvents}
          eventClick={handleEventClick}
          dateClick={handleDateClick}
          height="auto"
          eventDisplay="block"
          dayMaxEvents={3}
          eventClassNames="cursor-pointer text-xs"
        />
      </div>

      {selectedEvent && (
        <EventDetailModal
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          onUpdated={() => {
            setSelectedEvent(null)
            onEventUpdated()
          }}
        />
      )}
    </>
  )
}
