import type { Appointment, TodoItem } from '../types';

export function readAppointment(id: string, data: Record<string, unknown>): Appointment {
  const value = data.dateTime;
  const dateTime = typeof value === 'string' ? value : value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function' ? value.toDate().toISOString() : '';
  return { ...data, id, userId: String(data.userId || ''), title: String(data.title || ''),
    contactName: String(data.contactPerson ?? data.contactName ?? ''), notes: String(data.description ?? data.notes ?? ''), dateTime,
    status: data.isCompleted === true ? 'completed' : data.status === 'cancelled' ? 'cancelled' : data.status === 'completed' && !('isCompleted' in data) ? 'completed' : 'scheduled' };
}
export function readTodo(id: string, data: Record<string, unknown>): TodoItem {
  const priority = typeof data.priority === 'number' ? ['low', 'medium', 'high'][data.priority] : data.priority;
  return { ...data, id, userId: String(data.userId || ''), title: String(data.content ?? data.title ?? ''),
    priority: priority === 'high' || priority === 'medium' ? priority : 'low', completed: Boolean(data.isCompleted ?? data.completed) };
}
