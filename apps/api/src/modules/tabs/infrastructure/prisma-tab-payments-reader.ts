import type { TabPaymentEntry } from '@elite/shared';
import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../common/prisma/prisma.service';
import { civilRange } from '../../carwash/domain/civil-range';
import type { TabPaymentsReader } from '../application/ports/tab-payments-reader';
import { TAB_PAYMENT_ENTRY_INCLUDE, toTabPaymentEntry } from './tab-row';

/** Los abonos de un día civil para «Ventas del día» (106). */
@Injectable()
export class PrismaTabPaymentsReader implements TabPaymentsReader {
  constructor(private readonly prisma: PrismaService) {}

  async paymentsOn(date: string): Promise<TabPaymentEntry[]> {
    const rows = await this.prisma.payment.findMany({
      where: { tabId: { not: null }, paidAt: civilRange(date, date) },
      orderBy: [{ paidAt: 'desc' }, { id: 'desc' }],
      include: TAB_PAYMENT_ENTRY_INCLUDE,
    });

    return rows.flatMap((row) => {
      const entry = toTabPaymentEntry(row);

      return entry === null ? [] : [entry];
    });
  }
}
