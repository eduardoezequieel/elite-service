import { formatPlate } from './use-vehicle-search';

describe('formatPlate', () => {
  it('keeps alphanumeric characters after the prefix', () => {
    expect(formatPlate('P580AE')).toBe('P580-AE');
  });

  it('formats numeric plates with a dash after 3 characters', () => {
    expect(formatPlate('p123456')).toBe('P123-456');
  });

  it('assumes the P prefix when the plate starts with a digit', () => {
    expect(formatPlate('580AE')).toBe('P580-AE');
  });

  it('keeps two-letter prefixes', () => {
    expect(formatPlate('MB123456')).toBe('MB123-456');
  });

  it('caps the body at 6 characters', () => {
    expect(formatPlate('P123ABC99')).toBe('P123-ABC');
  });
});
