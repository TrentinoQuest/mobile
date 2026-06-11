// This file is required by karma.conf.js and loads recursively all the .spec and framework files

import 'zone.js/testing';
import { getTestBed } from '@angular/core/testing';
import {
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';
import { installCapacitorTestMocks } from './testing/capacitor-test-mocks';

// Registra il mock in-memory di Preferences PRIMA che i moduli applicativi
// importino @capacitor/preferences (registerPlugin e' first-wins).
installCapacitorTestMocks();

// First, initialize the Angular testing environment.
getTestBed().initTestEnvironment(BrowserDynamicTestingModule, platformBrowserDynamicTesting());
