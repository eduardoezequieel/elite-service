import { API_ERROR_CODES } from '@elite/shared';
import { HttpException } from '@nestjs/common';

import { InventoryCatalogUseCases } from './inventory-catalog.usecases';
import { InMemoryInventoryRepository } from './testing/in-memory-inventory.repository';

async function failure(promise: Promise<unknown>): Promise<{ status: number; code: string }> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof HttpException) {
      const body = error.getResponse() as { code: string };

      return { status: error.getStatus(), code: body.code };
    }
    throw error;
  }
  throw new Error('se esperaba un error');
}

describe('InventoryCatalogUseCases', () => {
  let repo: InMemoryInventoryRepository;
  let catalog: InventoryCatalogUseCases;

  beforeEach(() => {
    repo = new InMemoryInventoryRepository();
    catalog = new InventoryCatalogUseCases(repo);
  });

  describe('categorías', () => {
    it('crea y lista solo las activas por defecto', async () => {
      const ceras = await catalog.createCategory({ kind: 'PRODUCT', name: 'Ceras' });
      await catalog.createCategory({ kind: 'PRODUCT', name: 'Franelas', sortOrder: 2 });
      await catalog.updateCategory(ceras.id, { isActive: false });

      expect((await catalog.listCategories({})).map((c) => c.name)).toEqual(['Franelas']);
      expect(await catalog.listCategories({ includeInactive: true })).toHaveLength(2);
    });

    it('guarda el tipo y filtra por él (072)', async () => {
      await catalog.createCategory({ kind: 'PRODUCT', name: 'Bebidas' });
      const cleaning = await catalog.createCategory({ kind: 'SUPPLY', name: 'Limpieza' });

      expect(cleaning.kind).toBe('SUPPLY');
      expect((await catalog.listCategories({ kind: 'SUPPLY' })).map((c) => c.name)).toEqual([
        'Limpieza',
      ]);
      expect((await catalog.listCategories({ kind: 'PRODUCT' })).map((c) => c.name)).toEqual([
        'Bebidas',
      ]);
      expect(await catalog.listCategories({})).toHaveLength(2);
    });

    it('409 CATEGORY_NAME_TAKEN en el mismo tipo, sin distinguir mayúsculas', async () => {
      await catalog.createCategory({ kind: 'PRODUCT', name: 'Ceras' });

      expect(await failure(catalog.createCategory({ kind: 'PRODUCT', name: 'ceras' }))).toEqual({
        status: 409,
        code: API_ERROR_CODES.CATEGORY_NAME_TAKEN,
      });
    });

    it('el mismo nombre en el otro tipo sí se crea (072)', async () => {
      await catalog.createCategory({ kind: 'PRODUCT', name: 'Ceras' });

      await expect(
        catalog.createCategory({ kind: 'SUPPLY', name: 'Ceras' }),
      ).resolves.toMatchObject({ kind: 'SUPPLY', name: 'Ceras' });
    });

    it('renombrar solo choca con las de su tipo', async () => {
      await catalog.createCategory({ kind: 'PRODUCT', name: 'Franelas' });
      const supplies = await catalog.createCategory({ kind: 'SUPPLY', name: 'Trapos' });

      await expect(
        catalog.updateCategory(supplies.id, { name: 'Franelas' }),
      ).resolves.toMatchObject({ kind: 'SUPPLY', name: 'Franelas' });
    });

    it('renombrar a su propio nombre no choca; a otro sí', async () => {
      const ceras = await catalog.createCategory({ kind: 'PRODUCT', name: 'Ceras' });
      await catalog.createCategory({ kind: 'PRODUCT', name: 'Franelas' });

      await expect(catalog.updateCategory(ceras.id, { name: 'Ceras' })).resolves.toMatchObject({
        name: 'Ceras',
      });
      expect(await failure(catalog.updateCategory(ceras.id, { name: 'Franelas' }))).toEqual({
        status: 409,
        code: API_ERROR_CODES.CATEGORY_NAME_TAKEN,
      });
    });

    it('404 al editar una que no existe', async () => {
      expect((await failure(catalog.updateCategory('nope', { name: 'X' }))).status).toBe(404);
    });
  });

  describe('artículos', () => {
    it('un producto nace con código INV-0001, existencia cero y su precio', async () => {
      const item = await catalog.createItem({ kind: 'PRODUCT', name: 'Cera en pasta', price: '3' });

      expect(item).toMatchObject({
        code: 'INV-0001',
        kind: 'PRODUCT',
        price: '3.00',
        unit: 'unidad',
        stockOnHand: '0.000',
        minStock: '0.000',
        isLowStock: false,
        isActive: true,
      });
    });

    it('los códigos son correlativos', async () => {
      await catalog.createItem({ kind: 'PRODUCT', name: 'A', price: '1.00' });
      const second = await catalog.createItem({ kind: 'SUPPLY', name: 'B' });

      expect(second.code).toBe('INV-0002');
    });

    it('un insumo guarda precio cero (RN-1)', async () => {
      const item = await catalog.createItem({ kind: 'SUPPLY', name: 'Franela' });

      expect(item.price).toBe('0.00');
    });

    it('un insumo con precio responde 400 SUPPLY_HAS_PRICE', async () => {
      expect(
        await failure(catalog.createItem({ kind: 'SUPPLY', name: 'Franela', price: '2.00' })),
      ).toEqual({ status: 400, code: API_ERROR_CODES.SUPPLY_HAS_PRICE });
    });

    it('un producto sin precio responde 422', async () => {
      expect(
        (await failure(catalog.createItem({ kind: 'PRODUCT', name: 'Cera', price: '0.00' })))
          .status,
      ).toBe(422);
    });

    it('409 BARCODE_TAKEN al crear y al editar', async () => {
      await catalog.createItem({ kind: 'PRODUCT', name: 'A', price: '1.00', barcode: '750' });
      const other = await catalog.createItem({ kind: 'PRODUCT', name: 'B', price: '1.00' });

      expect(
        await failure(catalog.createItem({ kind: 'SUPPLY', name: 'C', barcode: '750' })),
      ).toEqual({ status: 409, code: API_ERROR_CODES.BARCODE_TAKEN });
      expect(await failure(catalog.updateItem(other.id, { barcode: '750' }))).toEqual({
        status: 409,
        code: API_ERROR_CODES.BARCODE_TAKEN,
      });
    });

    it('editar con su propio barcode no choca, y null lo quita', async () => {
      const item = await catalog.createItem({
        kind: 'PRODUCT',
        name: 'A',
        price: '1.00',
        barcode: '750',
      });

      await expect(catalog.updateItem(item.id, { barcode: '750' })).resolves.toMatchObject({
        barcode: '750',
      });
      await expect(catalog.updateItem(item.id, { barcode: null })).resolves.toMatchObject({
        barcode: null,
      });
    });

    it('422 si la categoría no existe', async () => {
      expect(
        (
          await failure(
            catalog.createItem({
              kind: 'SUPPLY',
              name: 'A',
              categoryId: '00000000-0000-4000-8000-000000000000',
            }),
          )
        ).status,
      ).toBe(422);
    });

    it('422 CATEGORY_KIND_MISMATCH al crear con una categoría del otro tipo (072)', async () => {
      const drinks = await catalog.createCategory({ kind: 'PRODUCT', name: 'Bebidas' });
      const cleaning = await catalog.createCategory({ kind: 'SUPPLY', name: 'Limpieza' });

      expect(
        await failure(
          catalog.createItem({ kind: 'SUPPLY', name: 'Franela', categoryId: drinks.id }),
        ),
      ).toEqual({ status: 422, code: API_ERROR_CODES.CATEGORY_KIND_MISMATCH });
      expect(
        await failure(
          catalog.createItem({
            kind: 'PRODUCT',
            name: 'Soda',
            price: '1.00',
            categoryId: cleaning.id,
          }),
        ),
      ).toEqual({ status: 422, code: API_ERROR_CODES.CATEGORY_KIND_MISMATCH });
      expect(repo.items.size).toBe(0);
    });

    it('422 CATEGORY_KIND_MISMATCH al editar con una categoría del otro tipo (072)', async () => {
      const drinks = await catalog.createCategory({ kind: 'PRODUCT', name: 'Bebidas' });
      const cleaning = await catalog.createCategory({ kind: 'SUPPLY', name: 'Limpieza' });
      const soda = await catalog.createItem({
        kind: 'PRODUCT',
        name: 'Soda',
        price: '1.00',
        categoryId: drinks.id,
      });

      expect(await failure(catalog.updateItem(soda.id, { categoryId: cleaning.id }))).toEqual({
        status: 422,
        code: API_ERROR_CODES.CATEGORY_KIND_MISMATCH,
      });
      expect((await catalog.findItem(soda.id)).category).toEqual({
        id: drinks.id,
        name: 'Bebidas',
      });
    });

    it('el precio de la edición se valida contra el tipo que ya tiene', async () => {
      const supply = await catalog.createItem({ kind: 'SUPPLY', name: 'Guantes' });
      const product = await catalog.createItem({ kind: 'PRODUCT', name: 'Cera', price: '3.00' });

      expect(await failure(catalog.updateItem(supply.id, { price: '1.00' }))).toEqual({
        status: 400,
        code: API_ERROR_CODES.SUPPLY_HAS_PRICE,
      });
      expect((await failure(catalog.updateItem(product.id, { price: '0' }))).status).toBe(422);
      await expect(catalog.updateItem(product.id, { price: '4.5' })).resolves.toMatchObject({
        price: '4.50',
        kind: 'PRODUCT',
      });
    });

    it('404 al leer o editar uno que no existe', async () => {
      expect((await failure(catalog.findItem('nope'))).status).toBe(404);
      expect((await failure(catalog.updateItem('nope', { name: 'X' }))).status).toBe(404);
    });

    it('lista con filtros de tipo, búsqueda, categoría, inactivos y paginación', async () => {
      const ceras = await catalog.createCategory({ kind: 'PRODUCT', name: 'Ceras' });
      await catalog.createItem({
        kind: 'PRODUCT',
        name: 'Cera en pasta',
        price: '3.00',
        categoryId: ceras.id,
      });
      await catalog.createItem({
        kind: 'PRODUCT',
        name: 'Aromatizante',
        price: '1.00',
        barcode: '7501',
      });
      const gloves = await catalog.createItem({ kind: 'SUPPLY', name: 'Guantes' });
      await catalog.updateItem(gloves.id, { isActive: false });

      const base = { page: 1, pageSize: 50 };

      expect((await catalog.listItems({ ...base, kind: 'PRODUCT' })).total).toBe(2);
      expect((await catalog.listItems({ ...base, kind: 'SUPPLY' })).total).toBe(0);
      expect(
        (await catalog.listItems({ ...base, kind: 'SUPPLY', includeInactive: true })).total,
      ).toBe(1);
      expect((await catalog.listItems({ ...base, search: 'cera' })).items[0].name).toBe(
        'Cera en pasta',
      );
      expect((await catalog.listItems({ ...base, search: '7501' })).items[0].name).toBe(
        'Aromatizante',
      );
      expect((await catalog.listItems({ ...base, search: 'inv-0001' })).total).toBe(1);
      expect((await catalog.listItems({ ...base, categoryId: ceras.id })).total).toBe(1);

      const firstPage = await catalog.listItems({ page: 1, pageSize: 1 });
      expect(firstPage).toMatchObject({ page: 1, pageSize: 1, total: 2 });
      expect(firstPage.items).toHaveLength(1);
    });
  });
});
