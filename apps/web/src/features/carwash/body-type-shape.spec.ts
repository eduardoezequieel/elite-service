import { BODY_TYPE_MODELS, bodyTypeShapeOf } from './body-type-shape';

describe('bodyTypeShapeOf (105)', () => {
  it('reconoce la moto por key', () => {
    expect(bodyTypeShapeOf('moto')).toBe('moto');
    expect(bodyTypeShapeOf('motorcycle')).toBe('moto');
    expect(bodyTypeShapeOf('motocicleta')).toBe('moto');
  });

  it('reconoce la moto por nombre aunque el key no diga nada', () => {
    expect(bodyTypeShapeOf('tipo-4', 'Moto')).toBe('moto');
    expect(bodyTypeShapeOf('tipo-4', 'Motocicleta')).toBe('moto');
    expect(bodyTypeShapeOf('tipo-4', 'Motorcycle')).toBe('moto');
  });

  it('los tres tipos de carro del seed no cambian', () => {
    expect(bodyTypeShapeOf('sedan', 'Sedán')).toBe('sedan');
    expect(bodyTypeShapeOf('suv', 'Camioneta')).toBe('suv');
    expect(bodyTypeShapeOf('pickup', 'Pick up')).toBe('pickup');
  });

  it('lo que no reconoce cae en sedán', () => {
    expect(bodyTypeShapeOf('hatchback', 'Hatchback')).toBe('sedan');
  });

  it('cada silueta tiene sus modelos de ejemplo', () => {
    expect(BODY_TYPE_MODELS.moto.split(',')).toHaveLength(3);
  });
});
