import React, { memo, useCallback, useEffect, useRef } from "react";
import PropTypes from "prop-types";
import { useKeyPressEvent } from "react-use";
import classnames from "classnames";

import "./Pagination.css";

// How fast the schedules advance while an arrow key is held down.
const HOLD_REPEAT_INTERVAL = 200;

const Pagination = ({
  title,
  activePage,
  numberOfPages,
  onPageChange,
  ...props
}) => {
  const isFirstPage = activePage === 1;
  const isLastPage = activePage >= numberOfPages;

  const wrapperClasses = classnames({ hidden: numberOfPages === 0 });
  const prevButtonClasses = classnames({ disabled: isFirstPage });
  const nextButtonClasses = classnames({ disabled: isLastPage });

  const goToPreviousPage = () => {
    if (activePage <= 1) {
      return false;
    }

    onPageChange(activePage - 1);

    return true;
  };

  const goToNextPage = () => {
    if (activePage >= numberOfPages) {
      return false;
    }

    onPageChange(activePage + 1);

    return true;
  };

  // The repeating timer outlives the render that started it, so it calls
  // through a ref that always holds the handlers of the latest render.
  // Reading activePage from a stale closure would recompute the same page.
  const step = useRef({ previous: goToPreviousPage, next: goToNextPage });
  step.current = { previous: goToPreviousPage, next: goToNextPage };

  const repeatTimer = useRef();

  const stopRepeating = useCallback(() => {
    clearInterval(repeatTimer.current);
    repeatTimer.current = undefined;
  }, []);

  const startRepeating = useCallback(
    (direction) => {
      if (repeatTimer.current) {
        return;
      }

      // The key press itself moves one schedule; holding keeps it going.
      const canContinue = step.current[direction]();

      if (!canContinue) {
        return;
      }

      repeatTimer.current = setInterval(() => {
        if (!step.current[direction]()) {
          stopRepeating();
        }
      }, HOLD_REPEAT_INTERVAL);
    },
    [stopRepeating]
  );

  useKeyPressEvent(
    "ArrowLeft",
    () => startRepeating("previous"),
    stopRepeating
  );
  useKeyPressEvent("ArrowRight", () => startRepeating("next"), stopRepeating);

  // A key released while the window is unfocused never reports a keyup.
  useEffect(() => {
    window.addEventListener("blur", stopRepeating);

    return () => {
      window.removeEventListener("blur", stopRepeating);
      stopRepeating();
    };
  }, [stopRepeating]);

  return (
    <div id="pagination" className={wrapperClasses} {...props}>
      <span id="prev" className={prevButtonClasses} onClick={goToPreviousPage}>
        &lt;{" "}
      </span>
      <div id="pages">
        <span id="title">{title}</span>
        <span id="page-numbers">
          {numberOfPages && activePage} / {numberOfPages}
        </span>
      </div>
      <span id="next" className={nextButtonClasses} onClick={goToNextPage}>
        {" "}
        &gt;
      </span>
    </div>
  );
};

Pagination.propTypes = {
  title: PropTypes.string.isRequired,
  activePage: PropTypes.number.isRequired,
  numberOfPages: PropTypes.number.isRequired,
  onPageChange: PropTypes.func.isRequired,
};

export default memo(Pagination);
