import { TestBed } from '@angular/core/testing';
import { ThemeService } from './theme.service';
import { preferencesStore } from '../../../../testing/capacitor-test-mocks';

// Stub matchMedia per controllare la preferenza OS simulata
const mockMatchMedia = (prefersDark: boolean) => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jasmine.createSpy('matchMedia').and.returnValue({
      matches: prefersDark,
      addEventListener: jasmine.createSpy('addEventListener'),
      removeEventListener: jasmine.createSpy('removeEventListener'),
    }),
  });
};

describe('ThemeService', () => {
  let service: ThemeService;

  beforeEach(() => {
    // Preferences e' mockato a livello di plugin (vedi capacitor-test-mocks):
    // lo store in-memory permette assert sulla persistenza.
    preferencesStore.clear();

    // document.documentElement: spia sull'attributo data-theme
    spyOn(document.documentElement, 'setAttribute');

    mockMatchMedia(false);

    TestBed.configureTestingModule({});
    service = TestBed.inject(ThemeService);
  });

  // ===========================================================================
  // Stato iniziale
  // ===========================================================================

  it('dovrebbe essere creato', () => {
    expect(service).toBeTruthy();
  });

  it('dovrebbe partire con mode === system', () => {
    expect(service.mode()).toBe('system');
  });

  // ===========================================================================
  // Ramo 1: modalita' LIGHT
  // ===========================================================================

  it('effectiveTheme dovrebbe essere light quando mode e light', async () => {
    await service.setMode('light');
    expect(service.effectiveTheme()).toBe('light');
    expect(document.documentElement.setAttribute).toHaveBeenCalledWith('data-theme', 'light');
  });

  // ===========================================================================
  // Ramo 2: modalita' DARK
  // ===========================================================================

  it('effectiveTheme dovrebbe essere dark quando mode e dark', async () => {
    await service.setMode('dark');
    expect(service.effectiveTheme()).toBe('dark');
    expect(document.documentElement.setAttribute).toHaveBeenCalledWith('data-theme', 'dark');
  });

  // ===========================================================================
  // Ramo 3: modalita' SYSTEM
  // ===========================================================================

  it('effectiveTheme dovrebbe essere light in modalita system quando OS e in light', async () => {
    // OS in light mode (matchMedia.matches = false)
    mockMatchMedia(false);
    // Ricrea il servizio con la nuova preferenza OS
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    service = TestBed.inject(ThemeService);

    await service.setMode('system');
    expect(service.effectiveTheme()).toBe('light');
  });

  it('effectiveTheme dovrebbe essere dark in modalita system quando OS e in dark', async () => {
    // OS in dark mode (matchMedia.matches = true)
    mockMatchMedia(true);
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    service = TestBed.inject(ThemeService);

    await service.setMode('system');
    expect(service.effectiveTheme()).toBe('dark');
  });

  // ===========================================================================
  // initialize(): ripristino dalla Preferences
  // ===========================================================================

  it('initialize() dovrebbe ripristinare la modalita salvata da Preferences', async () => {
    preferencesStore.set('tq_theme_mode', 'dark');

    await service.initialize();

    expect(service.mode()).toBe('dark');
    expect(service.effectiveTheme()).toBe('dark');
  });

  it('initialize() dovrebbe usare system come default se Preferences e vuoto', async () => {
    await service.initialize();

    expect(service.mode()).toBe('system');
  });

  // ===========================================================================
  // setMode(): persistenza
  // ===========================================================================

  it('setMode() dovrebbe salvare la scelta in Preferences', async () => {
    await service.setMode('light');

    expect(preferencesStore.get('tq_theme_mode')).toBe('light');
  });
});
