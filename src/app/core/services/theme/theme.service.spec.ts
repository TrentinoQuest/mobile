import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { Preferences } from '@capacitor/preferences';
import { ThemeService, ThemeMode } from './theme.service';

// Stub matchMedia per jsdom che non la implementa
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
    // Preferences: stub che non scrive nulla su disco
    spyOn(Preferences, 'get').and.resolveTo({ value: null });
    spyOn(Preferences, 'set').and.resolveTo();

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

  it('effectiveTheme dovrebbe essere light quando mode e light', fakeAsync(async () => {
    await service.setMode('light');
    expect(service.effectiveTheme()).toBe('light');
    expect(document.documentElement.setAttribute).toHaveBeenCalledWith('data-theme', 'light');
  }));

  // ===========================================================================
  // Ramo 2: modalita' DARK
  // ===========================================================================

  it('effectiveTheme dovrebbe essere dark quando mode e dark', fakeAsync(async () => {
    await service.setMode('dark');
    expect(service.effectiveTheme()).toBe('dark');
    expect(document.documentElement.setAttribute).toHaveBeenCalledWith('data-theme', 'dark');
  }));

  // ===========================================================================
  // Ramo 3: modalita' SYSTEM
  // ===========================================================================

  it('effectiveTheme dovrebbe essere light in modalita system quando OS e in light', fakeAsync(async () => {
    // OS in light mode (matchMedia.matches = false)
    mockMatchMedia(false);
    // Ricrea il servizio con la nuova preferenza OS
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    service = TestBed.inject(ThemeService);

    await service.setMode('system');
    expect(service.effectiveTheme()).toBe('light');
  }));

  it('effectiveTheme dovrebbe essere dark in modalita system quando OS e in dark', fakeAsync(async () => {
    // OS in dark mode (matchMedia.matches = true)
    mockMatchMedia(true);
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    service = TestBed.inject(ThemeService);

    await service.setMode('system');
    expect(service.effectiveTheme()).toBe('dark');
  }));

  // ===========================================================================
  // initialize(): ripristino dalla Preferences
  // ===========================================================================

  it('initialize() dovrebbe ripristinare la modalita salvata da Preferences', fakeAsync(async () => {
    (Preferences.get as jasmine.Spy).and.resolveTo({ value: 'dark' as ThemeMode });

    await service.initialize();

    expect(service.mode()).toBe('dark');
    expect(service.effectiveTheme()).toBe('dark');
  }));

  it('initialize() dovrebbe usare system come default se Preferences e vuoto', fakeAsync(async () => {
    (Preferences.get as jasmine.Spy).and.resolveTo({ value: null });

    await service.initialize();

    expect(service.mode()).toBe('system');
  }));

  // ===========================================================================
  // setMode(): persistenza
  // ===========================================================================

  it('setMode() dovrebbe salvare la scelta in Preferences', fakeAsync(async () => {
    await service.setMode('light');

    expect(Preferences.set).toHaveBeenCalledWith({
      key: 'tq_theme_mode',
      value: 'light',
    });
  }));
});
