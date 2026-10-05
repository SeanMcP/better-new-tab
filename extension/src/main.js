import { mountAppearance } from './appearance.js';
import { mountCalendar } from './calendar.js';
import { mountClock } from './clock.js';
import { mountNotes } from './notes.js';
import { mountWeather } from './weather.js';

const locale = navigator.language;
const toolbar = document.querySelector('.toolbar');
const calendar = mountCalendar(document.querySelector('.calendar'), { locale });

// Each widget is independent: one failing shouldn't blank the others.
const widgets = [
  mountAppearance(toolbar),
  mountClock(document.querySelector('.clock'), { toolbar, locale, onDayChange: () => calendar.render() }),
  mountWeather(document.querySelector('.weather'), { locale }),
  mountNotes(document.querySelector('.notes')),
];
for (const result of await Promise.allSettled(widgets)) {
  if (result.status === 'rejected') console.error(result.reason);
}
