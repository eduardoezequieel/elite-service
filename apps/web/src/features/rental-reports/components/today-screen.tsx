'use client';

import { MAX_PAGE_SIZE, PERMISSIONS, monthThroughToday } from '@elite/shared';
import { Plus, Search } from 'lucide-react';
import Link from 'next/link';

import { ScreenHeader } from '@/components/app-shell/screen-header';
import { Button } from '@/components/ui/button';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { useFleetVehicles } from '@/features/fleet/hooks/use-fleet';
import { useCalendar } from '@/features/rentals/hooks/use-agreements';
import { addDays, todayCivil } from '@/lib/civil-date';
import { useProfitability, useRentalToday } from '../hooks/use-rental-reports';
import { monthName } from '../report-view';
import { HOME_WEEK_DAYS } from '../today-home';
import { todayTitle } from '../today-format';
import { TodayFleet } from './today-fleet';
import { TodayLists } from './today-lists';
import { TodayMoney } from './today-money';
import { TodayWeek } from './today-week';

/** Hoy (125): flota, próximos 7 días, dinero del mes y pendientes. */

export function TodayScreen() {
  const { can } = usePermissions();
  const canManage = can(PERMISSIONS.rentals.actions.manage.key);
  const canCharge = can(PERMISSIONS.rentals.actions.charge.key);
  const canReports = can(PERMISSIONS.rentals.actions.reports.key);
  const canFleet = can(PERMISSIONS.fleet.actions.read.key);

  const today = useRentalToday();
  const civilToday = today.data?.date ?? todayCivil();
  const fleet = useFleetVehicles({ page: 1, pageSize: MAX_PAGE_SIZE }, canFleet);
  const calendar = useCalendar({
    from: civilToday,
    to: addDays(civilToday, HOME_WEEK_DAYS - 1),
  });
  const waitingForFleet = canFleet && fleet.isPending;
  const profitability = useProfitability(
    { ...monthThroughToday(civilToday), page: 1, pageSize: 1 },
    canReports,
  );
  const active =
    canFleet && fleet.data !== undefined ? fleet.data.total : (calendar.data?.length ?? 0);

  return (
    <div>
      <ScreenHeader title={todayTitle(civilToday)}>
        <Button asChild variant="outline">
          <Link href="/rentals/available">
            <Search aria-hidden />
            ¿Qué hay libre?
          </Link>
        </Button>
        {canManage ? (
          <Button asChild>
            <Link href="/rentals/agreements/new">
              <Plus aria-hidden />
              Nueva renta
            </Link>
          </Button>
        ) : null}
      </ScreenHeader>

      <div className="flex min-w-0 flex-col gap-8">
        {canFleet ? (
          <TodayFleet
            vehicles={fleet.data?.items ?? []}
            total={fleet.data?.total ?? 0}
            isLoading={fleet.isPending}
            errorMessage={fleet.error?.message ?? null}
          />
        ) : null}
        <TodayWeek
          rows={calendar.data ?? null}
          active={active}
          isLoading={calendar.isPending || (calendar.data !== undefined && waitingForFleet)}
          errorMessage={calendar.error?.message ?? null}
          today={civilToday}
        />
        <TodayMoney
          collected={today.data?.collected.total ?? null}
          collectedLoading={today.isPending}
          collectedError={today.error?.message ?? null}
          canCharge={canCharge}
          totals={profitability.data?.totals ?? null}
          monthLoading={canReports && profitability.isPending}
          monthError={canReports ? (profitability.error?.message ?? null) : null}
          monthLabel={monthName(civilToday.slice(0, 7)).toLowerCase()}
          showMonth={canReports}
        />
        <TodayLists
          today={today.data ?? null}
          todayLoading={today.isPending}
          todayError={today.error?.message ?? null}
          vehicles={canFleet ? (fleet.data?.items ?? null) : []}
          alertsLoading={waitingForFleet}
          alertsError={canFleet ? (fleet.error?.message ?? null) : null}
        />
      </div>
    </div>
  );
}
