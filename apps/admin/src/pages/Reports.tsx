import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import AppLayout from '../components/AppLayout';
import { useAuth } from '../contexts/AuthContext';
import {
  fetchDailyAttendanceReport,
  fetchRoutePerformanceReport,
  fetchDriverPerformanceReport,
  fetchBusPerformanceReport,
  type AttendanceReportRow,
  type AttendanceSummary,
  type RoutePerformanceRow,
  type DriverPerformanceRow,
  type BusPerformanceRow,
} from '../lib/queries/reports';
import { rowsToCsv, downloadCsv } from '../lib/csv';
import { downloadTablePdf } from '../lib/pdf';
import { inputClass, primaryButtonClass } from '../lib/formStyles';
import { localDateOnly } from '../lib/date';

type ReportTab = 'attendance' | 'route' | 'driver' | 'bus';

function todayISO() {
  return localDateOnly();
}

export default function ReportsPage() {
  const { t } = useTranslation('common');
  const { profile } = useAuth();

  const [tab, setTab] = useState<ReportTab>('attendance');
  const [dateFrom, setDateFrom] = useState(todayISO());
  const [dateTo, setDateTo] = useState(todayISO());
  const [loading, setLoading] = useState(true);

  const [attendanceRows, setAttendanceRows] = useState<AttendanceReportRow[]>([]);
  const [attendanceSummary, setAttendanceSummary] = useState<AttendanceSummary | null>(null);
  const [routeRows, setRouteRows] = useState<RoutePerformanceRow[]>([]);
  const [driverRows, setDriverRows] = useState<DriverPerformanceRow[]>([]);
  const [busRows, setBusRows] = useState<BusPerformanceRow[]>([]);

  async function load() {
    if (!profile?.school_id) return;
    setLoading(true);
    if (tab === 'attendance') {
      const { rows, summary } = await fetchDailyAttendanceReport(profile.school_id, dateFrom, dateTo);
      setAttendanceRows(rows);
      setAttendanceSummary(summary);
    } else if (tab === 'route') {
      setRouteRows(await fetchRoutePerformanceReport(profile.school_id, dateFrom, dateTo));
    } else if (tab === 'driver') {
      setDriverRows(await fetchDriverPerformanceReport(profile.school_id, dateFrom, dateTo));
    } else {
      setBusRows(await fetchBusPerformanceReport(profile.school_id, dateFrom, dateTo));
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [profile?.school_id, tab, dateFrom, dateTo]);

  function handleExport() {
    if (tab === 'attendance') {
      downloadCsv(
        `attendance_${dateFrom}_${dateTo}.csv`,
        rowsToCsv(
          ['Date', 'Student', 'Route', 'Stop', 'Status'],
          attendanceRows.map((r) => [r.date, r.studentName, r.routeName, r.stopName, r.status])
        )
      );
    } else if (tab === 'route') {
      downloadCsv(
        `route_performance_${dateFrom}_${dateTo}.csv`,
        rowsToCsv(
          ['Date', 'Route', 'Bus', 'Planned (min)', 'Actual (min)', 'Stops', 'Skipped', 'Deviations', 'Status'],
          routeRows.map((r) => [
            r.date,
            r.routeName,
            r.busNumber,
            r.plannedDurationMinutes,
            r.actualDurationMinutes,
            r.stopsTotal,
            r.stopsSkipped,
            r.deviationCount,
            r.status,
          ])
        )
      );
    } else if (tab === 'driver') {
      downloadCsv(
        `driver_performance_${dateFrom}_${dateTo}.csv`,
        rowsToCsv(
          ['Driver', 'Routes Completed', 'Routes Total', 'On-Time %', 'Deviations', 'Exceptions'],
          driverRows.map((r) => [r.driverName, r.routesCompleted, r.routesTotal, r.onTimePercent, r.deviationCount, r.exceptionCount])
        )
      );
    } else {
      downloadCsv(
        `bus_performance_${dateFrom}_${dateTo}.csv`,
        rowsToCsv(
          ['Bus', 'Trips', 'Delayed Trips', 'GPS Pings', 'Deviations'],
          busRows.map((r) => [r.busNumber, r.trips, r.delayedTrips, r.gpsPings, r.deviationCount])
        )
      );
    }
  }

  const TABS: { key: ReportTab; label: string }[] = [
    { key: 'attendance', label: 'Daily Attendance' },
    { key: 'route', label: 'Route Performance' },
    { key: 'driver', label: 'Driver Performance' },
    { key: 'bus', label: 'Bus Performance' },
  ];

  function handleExportPdf() {
    const subtitle = `${dateFrom} to ${dateTo}`;
    const tabLabel = TABS.find((tb) => tb.key === tab)?.label ?? '';
    if (tab === 'attendance') {
      downloadTablePdf(
        `attendance_${dateFrom}_${dateTo}.pdf`,
        tabLabel,
        subtitle,
        ['Date', 'Student', 'Route', 'Stop', 'Status'],
        attendanceRows.map((r) => [r.date, r.studentName, r.routeName, r.stopName, r.status.replace('_', ' ')])
      );
    } else if (tab === 'route') {
      downloadTablePdf(
        `route_performance_${dateFrom}_${dateTo}.pdf`,
        tabLabel,
        subtitle,
        ['Date', 'Route', 'Bus', 'Planned (min)', 'Actual (min)', 'Stops', 'Skipped', 'Deviations', 'Status'],
        routeRows.map((r) => [
          r.date,
          r.routeName,
          r.busNumber,
          r.plannedDurationMinutes,
          r.actualDurationMinutes,
          r.stopsTotal,
          r.stopsSkipped,
          r.deviationCount,
          r.status,
        ])
      );
    } else if (tab === 'driver') {
      downloadTablePdf(
        `driver_performance_${dateFrom}_${dateTo}.pdf`,
        tabLabel,
        subtitle,
        ['Driver', 'Routes Completed', 'Routes Total', 'On-Time %', 'Deviations', 'Exceptions'],
        driverRows.map((r) => [r.driverName, r.routesCompleted, r.routesTotal, r.onTimePercent, r.deviationCount, r.exceptionCount])
      );
    } else {
      downloadTablePdf(
        `bus_performance_${dateFrom}_${dateTo}.pdf`,
        tabLabel,
        subtitle,
        ['Bus', 'Trips', 'Delayed Trips', 'GPS Pings', 'Deviations'],
        busRows.map((r) => [r.busNumber, r.trips, r.delayedTrips, r.gpsPings, r.deviationCount])
      );
    }
  }

  return (
    <AppLayout>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Reports</h1>
        <div className="flex gap-2">
          <button onClick={handleExport} className={primaryButtonClass}>
            Export CSV
          </button>
          <button onClick={handleExportPdf} className={primaryButtonClass}>
            Export PDF
          </button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex gap-2">
          {TABS.map((tb) => (
            <button
              key={tb.key}
              onClick={() => setTab(tb.key)}
              className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                tab === tb.key ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {tb.label}
            </button>
          ))}
        </div>
        <div className="ms-auto flex items-center gap-2">
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={inputClass} />
          <span className="text-slate-400">–</span>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={inputClass} />
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-slate-400">{t('loading')}</div>
      ) : (
        <>
          {tab === 'attendance' && attendanceSummary && (
            <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
              {(
                [
                  ['Scheduled', attendanceSummary.scheduled],
                  ['Picked Up', attendanceSummary.pickedUp],
                  ['Dropped Off', attendanceSummary.droppedOff],
                  ['Absent', attendanceSummary.absent],
                  ['Not Confirmed', attendanceSummary.notConfirmed],
                ] as const
              ).map(([label, value]) => (
                <div key={label} className="rounded-xl border border-slate-200 bg-white p-3 text-center">
                  <p className="text-xs text-slate-500">{label}</p>
                  <p className="text-xl font-semibold text-slate-900">{value}</p>
                </div>
              ))}
            </div>
          )}

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            {tab === 'attendance' && (
              <table className="w-full text-start text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3 text-start">Date</th>
                    <th className="px-4 py-3 text-start">Student</th>
                    <th className="px-4 py-3 text-start">Route</th>
                    <th className="px-4 py-3 text-start">Stop</th>
                    <th className="px-4 py-3 text-start">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {attendanceRows.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                        No data for this range.
                      </td>
                    </tr>
                  )}
                  {attendanceRows.map((r, i) => (
                    <tr key={i}>
                      <td className="px-4 py-3 text-slate-600">{r.date}</td>
                      <td className="px-4 py-3 font-medium text-slate-800">{r.studentName}</td>
                      <td className="px-4 py-3 text-slate-600">{r.routeName}</td>
                      <td className="px-4 py-3 text-slate-600">{r.stopName}</td>
                      <td className="px-4 py-3 capitalize text-slate-600">{r.status.replace('_', ' ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {tab === 'route' && (
              <table className="w-full text-start text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3 text-start">Date</th>
                    <th className="px-4 py-3 text-start">Route</th>
                    <th className="px-4 py-3 text-start">Bus</th>
                    <th className="px-4 py-3 text-start">Planned</th>
                    <th className="px-4 py-3 text-start">Actual</th>
                    <th className="px-4 py-3 text-start">Stops</th>
                    <th className="px-4 py-3 text-start">Skipped</th>
                    <th className="px-4 py-3 text-start">Deviations</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {routeRows.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                        No data for this range.
                      </td>
                    </tr>
                  )}
                  {routeRows.map((r, i) => (
                    <tr key={i}>
                      <td className="px-4 py-3 text-slate-600">{r.date}</td>
                      <td className="px-4 py-3 font-medium text-slate-800">{r.routeName}</td>
                      <td className="px-4 py-3 text-slate-600">{r.busNumber}</td>
                      <td className="px-4 py-3 text-slate-600">{r.plannedDurationMinutes ?? '—'} min</td>
                      <td className="px-4 py-3 text-slate-600">{r.actualDurationMinutes ?? '—'} min</td>
                      <td className="px-4 py-3 text-slate-600">{r.stopsTotal}</td>
                      <td className="px-4 py-3 text-slate-600">{r.stopsSkipped}</td>
                      <td className="px-4 py-3 text-slate-600">{r.deviationCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {tab === 'driver' && (
              <table className="w-full text-start text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3 text-start">Driver</th>
                    <th className="px-4 py-3 text-start">Completed</th>
                    <th className="px-4 py-3 text-start">Total Routes</th>
                    <th className="px-4 py-3 text-start">On-Time %</th>
                    <th className="px-4 py-3 text-start">Deviations</th>
                    <th className="px-4 py-3 text-start">Exceptions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {driverRows.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                        No data for this range.
                      </td>
                    </tr>
                  )}
                  {driverRows.map((r, i) => (
                    <tr key={i}>
                      <td className="px-4 py-3 font-medium text-slate-800">{r.driverName}</td>
                      <td className="px-4 py-3 text-slate-600">{r.routesCompleted}</td>
                      <td className="px-4 py-3 text-slate-600">{r.routesTotal}</td>
                      <td className="px-4 py-3 text-slate-600">{r.onTimePercent}%</td>
                      <td className="px-4 py-3 text-slate-600">{r.deviationCount}</td>
                      <td className="px-4 py-3 text-slate-600">{r.exceptionCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {tab === 'bus' && (
              <table className="w-full text-start text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3 text-start">Bus</th>
                    <th className="px-4 py-3 text-start">Trips</th>
                    <th className="px-4 py-3 text-start">Delayed</th>
                    <th className="px-4 py-3 text-start">GPS Pings</th>
                    <th className="px-4 py-3 text-start">Deviations</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {busRows.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                        No data for this range.
                      </td>
                    </tr>
                  )}
                  {busRows.map((r, i) => (
                    <tr key={i}>
                      <td className="px-4 py-3 font-medium text-slate-800">{r.busNumber}</td>
                      <td className="px-4 py-3 text-slate-600">{r.trips}</td>
                      <td className="px-4 py-3 text-slate-600">{r.delayedTrips}</td>
                      <td className="px-4 py-3 text-slate-600">{r.gpsPings}</td>
                      <td className="px-4 py-3 text-slate-600">{r.deviationCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <p className="mt-3 text-xs text-slate-400">
            On-Time % is approximated as routes with zero route-deviation alerts, since v1 doesn't yet store a
            scheduled start time to compare against.
          </p>
        </>
      )}
    </AppLayout>
  );
}
