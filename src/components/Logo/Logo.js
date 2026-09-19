import React, { memo } from "react";

import "./Logo.css";

const Logo = () => (
  <div id="metu-scheduler">
    <img
  id="metu-mark"
  src="./icons/favicon.svg"
  alt=""
  aria-hidden="true"
/>
    <span id="scheduler-title">
      METU
      <br />
      SCHEDULER
    </span>
  </div>
);

export default memo(Logo);
