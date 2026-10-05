import { addTabLinesSchema, payTabSchema, tabsQuerySchema } from '@elite/shared';
import type { AddTabLinesInput, PayTabInput, TabsQuery } from '@elite/shared';

import { InMemoryLowStockEvents } from '../../inventory/application/testing/in-memory-low-stock-events';
import { InMemoryTabLookups, InMemoryTabRepository, TabsWorld } from './testing/in-memory-tabs';
import { TabUseCases } from './tab.usecases';

const USER = 'user-karla';
const ACTOR = { userId: USER, event: null };
const JUAN = '11111111-1111-4111-8111-111111111111';
const ANA = '22222222-2222-4222-8222-222222222222';
const GONE = '33333333-3333-4333-8333-333333333333';
const ROBERTO = '44444444-4444-4444-8444-444444444444';
const COLA = '55555555-5555-4555-8555-555555555555';
const WATER = '66666666-6666-4666-8666-666666666666';
const TOWEL = '77777777-7777-4777-8777-777777777777';
const OLD = '88888888-8888-4888-8888-888888888888';
const ACCOUNT = '99999999-9999-4999-8999-999999999999';

function setup() {
  const world = new TabsWorld();

  world.users.set(USER, 'Karla');
  world.employees.set(JUAN, { fullName: 'Juan Pérez', isActive: true });
  world.employees.set(ANA, { fullName: 'Ana López', isActive: true });
  world.employees.set(GONE, { fullName: 'Baja Ruiz', isActive: false });
  world.customers.set(ROBERTO, { fullName: 'Roberto Alas', phone: '7777-0000', plate: 'P512873' });
  world.items.set(COLA, item(COLA, 'Coca-Cola lata', 100, 10));
  world.items.set(WATER, item(WATER, 'Agua 600 ml', 75, 5));
  world.items.set(TOWEL, { ...item(TOWEL, 'Franela', 0, 20), kind: 'SUPPLY' });
  world.items.set(OLD, { ...item(OLD, 'Jugo', 90, 4), isActive: false });
  world.activeBankAccounts.add(ACCOUNT);

  const repository = new InMemoryTabRepository(world);
  const useCases = new TabUseCases(
    repository,
    new InMemoryTabLookups(world),
    new InMemoryLowStockEvents(),
  );

  return { world, repository, useCases };
}

function item(id: string, name: string, price: number, stock: number) {
  return {
    id,
    code: `INV-${name.length}`,
    name,
    kind: 'PRODUCT' as const,
    isActive: true,
    price,
    stock: stock * 1000,
  };
}

function lines(holder: AddTabLinesInput['holder'], ...items: [string, string][]): AddTabLinesInput {
  return addTabLinesSchema.parse({
    holder,
    items: items.map(([inventoryItemId, quantity]) => ({ inventoryItemId, quantity })),
  });
}

const juan = { kind: 'EMPLOYEE' as const, id: JUAN };
const roberto = { kind: 'CUSTOMER' as const, id: ROBERTO };

function payment(amount: string, extra: Partial<PayTabInput> = {}): PayTabInput {
  return payTabSchema.parse({ method: 'CASH', amount, ...extra });
}

function query(raw: Record<string, string> = {}): TabsQuery {
  return tabsQuerySchema.parse(raw);
}

describe('TabUseCases (105)', () => {
  describe('anotar (RN-1 a RN-4)', () => {
    it('opens C-0001 for someone without a tab and takes the product out of stock', async () => {
      const { world, useCases } = setup();

      const tab = await useCases.addLines(lines(juan, [COLA, '2'], [WATER, '1']), ACTOR);

      expect(tab).toMatchObject({
        number: 'C-0001',
        status: 'OPEN',
        holder: { kind: 'EMPLOYEE', id: JUAN, fullName: 'Juan Pérez' },
        total: '2.75',
        paid: '0.00',
        balance: '2.75',
        units: '3.000',
        openedBy: { id: USER, fullName: 'Karla' },
      });
      expect(
        tab.lines.map((line) => [line.name, line.unitPrice, line.quantity, line.total]),
      ).toEqual(
        expect.arrayContaining([
          ['Coca-Cola lata', '1.00', '2.000', '2.00'],
          ['Agua 600 ml', '0.75', '1.000', '0.75'],
        ]),
      );
      expect(tab.lines.every((line) => line.createdBy.fullName === 'Karla')).toBe(true);
      expect(world.items.get(COLA)?.stock).toBe(8000);
      expect(world.movements.filter((movement) => movement.type === 'SALE')).toHaveLength(2);
    });

    it('adds to the open tab of the same holder and opens a new number for another', async () => {
      const { useCases } = setup();
      const first = await useCases.addLines(lines(juan, [COLA, '1']), ACTOR);

      const again = await useCases.addLines(lines(juan, [WATER, '1']), ACTOR);
      const other = await useCases.addLines(lines(roberto, [COLA, '1']), ACTOR);

      expect(again.id).toBe(first.id);
      expect(again.balance).toBe('1.75');
      expect(again.lines).toHaveLength(2);
      expect(other.number).toBe('C-0002');
      expect(other.holder.kind).toBe('CUSTOMER');
    });

    it('freezes the price at the moment of writing it down', async () => {
      const { world, useCases } = setup();
      const tab = await useCases.addLines(lines(juan, [COLA, '1']), ACTOR);
      const cola = world.items.get(COLA);

      if (cola !== undefined) cola.price = 150;

      const detail = await useCases.findById(tab.id);

      expect(detail.lines[0]?.unitPrice).toBe('1.00');
      expect(detail.balance).toBe('1.00');
    });

    it('rejects an inactive employee and an unknown customer', async () => {
      const { useCases } = setup();

      await expect(
        useCases.addLines(lines({ kind: 'EMPLOYEE', id: GONE }, [COLA, '1']), ACTOR),
      ).rejects.toMatchObject({ code: 'EMPLOYEE_NOT_FOUND' });
      await expect(
        useCases.addLines(lines({ kind: 'CUSTOMER', id: ANA }, [COLA, '1']), ACTOR),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });

    it('applies the counter-sale product rules and leaves nothing behind', async () => {
      const { world, useCases } = setup();

      await expect(useCases.addLines(lines(juan, [TOWEL, '1']), ACTOR)).rejects.toMatchObject({
        code: 'ITEM_NOT_SELLABLE',
      });
      await expect(useCases.addLines(lines(juan, [OLD, '1']), ACTOR)).rejects.toMatchObject({
        code: 'ITEM_INACTIVE',
      });
      await expect(
        useCases.addLines(lines(juan, [COLA, '1'], [WATER, '6']), ACTOR),
      ).rejects.toMatchObject({
        code: 'INSUFFICIENT_STOCK',
        details: { itemId: WATER, available: '5.000' },
      });
      expect(world.tabs).toHaveLength(0);
      expect(world.items.get(COLA)?.stock).toBe(10000);
    });
  });

  describe('quitar una línea (RN-5)', () => {
    it('gives the product back, strikes the line with its reason and lowers the balance', async () => {
      const { world, useCases } = setup();
      const tab = await useCases.addLines(lines(juan, [COLA, '2'], [WATER, '1']), ACTOR);
      const cola = tab.lines.find((line) => line.inventoryItemId === COLA);

      const after = await useCases.voidLine(
        tab.id,
        cola?.id ?? '',
        { reason: 'Era de Luis' },
        ACTOR,
      );

      const voided = after.lines.find((line) => line.id === cola?.id);
      expect(voided?.voided).toMatchObject({ by: { fullName: 'Karla' }, reason: 'Era de Luis' });
      expect(voided?.isVoidable).toBe(false);
      expect(after).toMatchObject({
        total: '0.75',
        balance: '0.75',
        units: '1.000',
        status: 'OPEN',
      });
      expect(world.items.get(COLA)?.stock).toBe(10000);
      const sale = world.movements.find((m) => m.tabLineId === cola?.id && m.type === 'SALE');
      expect(world.movements.find((m) => m.type === 'SALE_RETURN')).toMatchObject({
        quantity: 2000,
        reversesMovementId: sale?.id,
      });
    });

    it('voids a line only once', async () => {
      const { useCases } = setup();
      const tab = await useCases.addLines(lines(juan, [COLA, '1'], [WATER, '1']), ACTOR);
      const lineId = tab.lines[0]?.id ?? '';

      await useCases.voidLine(tab.id, lineId, { reason: 'Mal anotado' }, ACTOR);

      await expect(
        useCases.voidLine(tab.id, lineId, { reason: 'Otra vez' }, ACTOR),
      ).rejects.toMatchObject({ code: 'TAB_LINE_ALREADY_VOIDED' });
    });

    it('refuses a void that would leave the balance below what was paid', async () => {
      const { useCases } = setup();
      const tab = await useCases.addLines(lines(juan, [COLA, '2'], [WATER, '1']), ACTOR);
      await useCases.pay(tab.id, payment('2.50'), ACTOR);
      const cola = tab.lines.find((line) => line.inventoryItemId === COLA);

      const detail = await useCases.findById(tab.id);
      expect(detail.lines.find((line) => line.id === cola?.id)?.isVoidable).toBe(false);
      await expect(
        useCases.voidLine(tab.id, cola?.id ?? '', { reason: 'Mal anotado' }, ACTOR),
      ).rejects.toMatchObject({
        code: 'TAB_LINE_NOT_VOIDABLE',
        details: { balance: '0.25', lineTotal: '2.00' },
      });
    });

    it('closes the tab when the void leaves nothing owed (RN-8)', async () => {
      const { useCases } = setup();
      const tab = await useCases.addLines(lines(juan, [COLA, '1'], [WATER, '1']), ACTOR);
      await useCases.pay(tab.id, payment('1.00'), ACTOR);
      const water = tab.lines.find((line) => line.inventoryItemId === WATER);

      const after = await useCases.voidLine(
        tab.id,
        water?.id ?? '',
        { reason: 'No la tomó' },
        ACTOR,
      );

      expect(after).toMatchObject({ status: 'CLOSED', balance: '0.00', paid: '1.00' });
      expect(after.closedAt).not.toBeNull();
    });

    it('answers 404 for a line of another tab', async () => {
      const { useCases } = setup();
      const mine = await useCases.addLines(lines(juan, [COLA, '1']), ACTOR);
      const other = await useCases.addLines(lines(roberto, [COLA, '1']), ACTOR);

      await expect(
        useCases.voidLine(mine.id, other.lines[0]?.id ?? '', { reason: 'Cruzada' }, ACTOR),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });
  });

  describe('cobrar un abono (RN-7, RN-8)', () => {
    it('records a partial payment and keeps the tab open', async () => {
      const { world, useCases } = setup();
      const tab = await useCases.addLines(lines(juan, [COLA, '3']), ACTOR);

      const after = await useCases.pay(tab.id, payment('1.00'), ACTOR);

      expect(after).toMatchObject({ status: 'OPEN', paid: '1.00', balance: '2.00' });
      expect(after.payments).toEqual([
        expect.objectContaining({
          method: 'CASH',
          amount: '1.00',
          recordedBy: { id: USER, fullName: 'Karla' },
        }),
      ]);
      expect(world.tabs[0]?.payments[0]?.cashSessionId).toBe('cash-1');
    });

    it('closes the tab when the payment covers the balance, and the next write-down opens a new one', async () => {
      const { useCases } = setup();
      const tab = await useCases.addLines(lines(juan, [COLA, '3']), ACTOR);

      const paid = await useCases.pay(tab.id, payment('3.00'), ACTOR);
      const next = await useCases.addLines(lines(juan, [WATER, '1']), ACTOR);

      expect(paid).toMatchObject({ status: 'CLOSED', balance: '0.00' });
      expect(next.id).not.toBe(tab.id);
      expect(next.number).toBe('C-0002');
      await expect(useCases.pay(tab.id, payment('0.50'), ACTOR)).rejects.toMatchObject({
        code: 'TAB_CLOSED',
      });
      await expect(
        useCases.voidLine(tab.id, paid.lines[0]?.id ?? '', { reason: 'Tarde' }, ACTOR),
      ).rejects.toMatchObject({ code: 'TAB_CLOSED' });
    });

    it('refuses more than the balance, without an open cash session or with an inactive account', async () => {
      const { world, useCases } = setup();
      const tab = await useCases.addLines(lines(juan, [COLA, '2']), ACTOR);

      await expect(useCases.pay(tab.id, payment('2.01'), ACTOR)).rejects.toMatchObject({
        code: 'PAYMENT_EXCEEDS_BALANCE',
        details: { balance: '2.00' },
      });
      await expect(
        useCases.pay(
          tab.id,
          payment('1.00', {
            method: 'TRANSFER',
            bankAccountId: '12121212-1212-4212-8212-121212121212',
            reference: 'ABC',
          }),
          ACTOR,
        ),
      ).rejects.toMatchObject({ code: 'BANK_ACCOUNT_UNAVAILABLE' });

      world.openCashSessionId = null;

      await expect(useCases.pay(tab.id, payment('1.00'), ACTOR)).rejects.toMatchObject({
        code: 'CASH_NOT_OPEN',
      });
      expect((await useCases.findById(tab.id)).payments).toHaveLength(0);
    });

    it('takes a transfer to an active account with its reference', async () => {
      const { useCases } = setup();
      const tab = await useCases.addLines(lines(roberto, [COLA, '2']), ACTOR);

      const after = await useCases.pay(
        tab.id,
        payment('2.00', { method: 'TRANSFER', bankAccountId: ACCOUNT, reference: 'TRX-9' }),
        ACTOR,
      );

      expect(after.payments[0]).toMatchObject({ method: 'TRANSFER', reference: 'TRX-9' });
      expect(after.status).toBe('CLOSED');
    });

    it('translates a rule lost in the race the same way (090)', async () => {
      const { repository, useCases } = setup();
      const tab = await useCases.addLines(lines(juan, [COLA, '2']), ACTOR);

      // Otra caja cobra todo entre la lectura y la escritura.
      repository.beforeWrite = () => {
        repository.beforeWrite = null;
        void repository.pay({
          tabId: tab.id,
          method: 'CASH',
          amount: 200,
          bankAccountId: null,
          reference: null,
          description: null,
          userId: USER,
          cashSessionId: 'cash-1',
        });
      };

      await expect(useCases.pay(tab.id, payment('1.00'), ACTOR)).rejects.toMatchObject({
        code: 'TAB_CLOSED',
      });
    });

    it('rejects a zero payment in the contract', () => {
      expect(payTabSchema.safeParse({ method: 'CASH', amount: '0' }).success).toBe(false);
    });
  });

  describe('lecturas', () => {
    async function seeded() {
      const context = setup();
      const { useCases } = context;
      const juanTab = await useCases.addLines(lines(juan, [COLA, '1']), ACTOR);
      const anaTab = await useCases.addLines(
        lines({ kind: 'EMPLOYEE', id: ANA }, [COLA, '4']),
        ACTOR,
      );
      const robertoTab = await useCases.addLines(lines(roberto, [WATER, '2']), ACTOR);
      await useCases.pay(juanTab.id, payment('1.00'), ACTOR);

      return { ...context, juanTab, anaTab, robertoTab };
    }

    it('lists open tabs by balance with the totals of every open tab', async () => {
      const { useCases, anaTab, robertoTab } = await seeded();

      const list = await useCases.list(query());

      expect(list.summary).toEqual({
        owed: '5.50',
        owedByEmployees: '4.00',
        owedByCustomers: '1.50',
        openCount: 2,
        employeeCount: 1,
        customerCount: 1,
        closedCount: 1,
      });
      expect(list.tabs.items.map((tab) => tab.id)).toEqual([anaTab.id, robertoTab.id]);
      expect(list.tabs.total).toBe(2);
    });

    it('filters by holder kind, closed tabs and searches by name or number', async () => {
      const { useCases, juanTab, robertoTab } = await seeded();

      expect(
        (await useCases.list(query({ holder: 'CUSTOMER' }))).tabs.items.map((t) => t.id),
      ).toEqual([robertoTab.id]);
      expect(
        (await useCases.list(query({ status: 'CLOSED' }))).tabs.items.map((t) => t.id),
      ).toEqual([juanTab.id]);
      expect(
        (await useCases.list(query({ search: 'robert' }))).tabs.items.map((t) => t.id),
      ).toEqual([robertoTab.id]);
      expect(
        (await useCases.list(query({ search: 'C-0003' }))).tabs.items.map((t) => t.id),
      ).toEqual([robertoTab.id]);
      expect((await useCases.list(query({ search: '3' }))).tabs.items.map((t) => t.id)).toEqual([
        robertoTab.id,
      ]);
    });

    it('offers active employees and customers with their open tab, debtors first', async () => {
      const { world, useCases, anaTab, robertoTab } = await seeded();
      world.customers.set('aaaa', { fullName: 'Aaron Sin Cuenta', phone: null, plate: null });

      const options = await useCases.holders({});

      expect(options.employees.map((option) => option.fullName)).toEqual([
        'Ana López',
        'Juan Pérez',
      ]);
      expect(options.employees[0]?.openTab).toEqual({
        id: anaTab.id,
        number: anaTab.number,
        balance: '4.00',
      });
      expect(options.employees[1]?.openTab).toBeNull();
      expect(options.customers.map((option) => [option.fullName, option.detail])).toEqual([
        ['Roberto Alas', 'P512873'],
        ['Aaron Sin Cuenta', null],
      ]);
      expect(options.customers[0]?.openTab?.id).toBe(robertoTab.id);
      expect((await useCases.holders({ search: '512' })).customers.map((o) => o.id)).toEqual([
        ROBERTO,
      ]);
    });

    it('answers 404 for a tab that does not exist', async () => {
      const { useCases } = setup();

      await expect(useCases.findById('nope')).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });
  });
});
