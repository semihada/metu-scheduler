import React, { memo } from "react";

import "./Logo.css";

const Logo = () => (
  <div id="metu-scheduler">
    <span id="metu-mark" aria-hidden="true">M</span>
    <span id="scheduler-title">
      METU
      <br />
      SCHEDULER
    </span>
  </div>
);

export default memo(Logo);
