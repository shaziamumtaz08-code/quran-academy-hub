import React from 'react';

interface NextClassBannerProps {
  title: string;
  scheduleLabel: string;
  countdownLabel: string;
  action: React.ReactNode;
}

export function NextClassBanner({ title, scheduleLabel, countdownLabel, action }: NextClassBannerProps) {
  return (
    <section className="dashboard-next-class-banner" aria-label="Next class banner">
      <div className="dashboard-next-class-banner__label">
        <span className="digital-neon">NEXT CLASS</span>
      </div>

      <div className="dashboard-next-class-banner__body">
        <div className="dashboard-next-class-banner__course-block">
          <p className="dashboard-next-class-banner__course-title">{title}</p>
        </div>

        <div className="dashboard-next-class-banner__side">
          <div className="dashboard-next-class-banner__action">{action}</div>

          <div className="dashboard-next-class-banner__meta">
            <p className="dashboard-next-class-banner__schedule">{scheduleLabel}</p>
            <p className="dashboard-next-class-banner__countdown">{countdownLabel}</p>
          </div>
        </div>
      </div>
    </section>
  );
}