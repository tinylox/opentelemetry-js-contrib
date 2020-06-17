import { BaseMetricPlugin } from '@opentelemetry/core/build/src/platform/browser';
import { otperformance } from '@opentelemetry/core';
import { MetricPluginConfig } from '@opentelemetry/api';
import { MetricObservable } from '@opentelemetry/metrics';
import {
    hasKey,
    PerformanceEntries,
    PerformanceLegacy,
    PerformanceTimingNames as PTN,
  } from '@opentelemetry/web';


export class MeterDocumentLoad extends BaseMetricPlugin<unknown> {
    constructor(config: MetricPluginConfig = {}) {
        super('@opentelemetry/plugin-document-load');
        this._onDocumentLoaded = this._onDocumentLoaded.bind(this);
        this._config = config;
    }

    private _onDocumentLoaded() {
        // Timeout is needed as load event doesn't yet have the performance metrics for loadEnd.
        // Support for event "loadend" is very limited and cannot be used
        window.setTimeout(() => {
            this._collectPerformance();
        });
    }

    private _collectPerformance() {
        const entries = this._getEntries();
        console.log(entries);
        const loadTimeObserver = this._meter.createObserver('document-load', {
            description: 'Documet load time',
        });
        const loadTime = new MetricObservable();
        loadTimeObserver.setCallback((observerResult) => {
            observerResult.observe(loadTime, {});
        });
        loadTime.next(Number(entries[PTN.LOAD_EVENT_END]) - Number(entries[PTN.FETCH_START]));
    }

    private _getEntries() {
    const entries: PerformanceEntries = {};
    const performanceNavigationTiming = (otperformance.getEntriesByType(
      'navigation'
    )[0] as unknown) as PerformanceEntries;

    if (performanceNavigationTiming) {
      const keys = Object.values(PTN);
      keys.forEach((key: string) => {
        if (hasKey(performanceNavigationTiming, key)) {
          const value = performanceNavigationTiming[key];
          if (typeof value === 'number' && value > 0) {
            entries[key] = value;
          }
        }
      });
    } else {
      // // fallback to previous version
      const perf: typeof otperformance & PerformanceLegacy = otperformance;
      const performanceTiming = perf.timing;
      if (performanceTiming) {
        const keys = Object.values(PTN);
        keys.forEach((key: string) => {
          if (hasKey(performanceTiming, key)) {
            const value = performanceTiming[key];
            if (typeof value === 'number' && value > 0) {
              entries[key] = value;
            }
          }
        });
      }
    }
    return entries;
  }

    /**
   * executes callback {_onDocumentLoaded} when the page is loaded
   */
    private _waitForPageLoad() {
        if (window.document.readyState === 'complete') {
            this._onDocumentLoaded();
        } else {
            window.addEventListener('load', this._onDocumentLoaded);
        }
    }

    /**
    * implements patch function
    */
    protected patch() {
        this._waitForPageLoad();
        return this._moduleExports;
    }

    /**
    * implements unpatch function
    */
    protected unpatch() {
        window.removeEventListener('load', this._onDocumentLoaded);
    }
}
