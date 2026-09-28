import html2canvas from "html2canvas";

// Schedule generation is a cartesian product of the selected courses' sections.
// Pruning overlapping combinations keeps that product small, but allowing
// collisions removes that pruning, so the product can reach millions for a
// normal course load (e.g. 5 courses ~ 300k combinations). Cap the number of
// generated schedules to keep the page responsive.
const MAX_COLLIDED_SCHEDULES = 500;

const reduceOfferings = (offerings, [departmentCode, departmentOfferings]) => {
  const courses = Object.entries(departmentOfferings).map(
    ([courseCode, course]) => ({
      selectedInstructor: "All",
      departmentCode,
      courseCode,
      ...course,
    })
  );

  return [...offerings, ...courses];
};

const areTimeslotsOverlapping = (...timeslots) => {
  const mergedTimeslots = new Set(timeslots.flat());

  const totalTimeslots = timeslots.reduce(
    (total, timeslot) => total + timeslot.length,
    0
  );

  return mergedTimeslots.size !== totalTimeslots;
};

const getSectionsOf = (schedule) => Object.keys(schedule.timeslots);

const buildSchedule = (
  excludedTimeslots,
  courseSection,
  schedule,
  allowCollisions
) => {
  const isTimeslotExcluded = areTimeslotsOverlapping(
    Object.keys(excludedTimeslots),
    Object.keys(courseSection.schedule)
  );

  if (isTimeslotExcluded) {
    return null;
  }

  const isTimeslotTaken = areTimeslotsOverlapping(
    Object.keys(courseSection.schedule),
    getSectionsOf(schedule)
  );

  if (isTimeslotTaken && !allowCollisions) {
    return null;
  }

  const course = {
    courseCode: courseSection.courseCode,
    courseName: courseSection.courseName,
    instructor: courseSection.instructor,
  };

  // Every timeslot holds a list of entries: one for a free slot, more than one
  // when the course collides with a course already placed on that timeslot.
  const timeslots = { ...schedule.timeslots };

  for (const key of Object.keys(courseSection.schedule)) {
    const entry = {
      classroom: courseSection.schedule[key],
      course: schedule.courses.length,
    };

    timeslots[key] = [...(timeslots[key] || []), entry];
  }

  return {
    courses: [...schedule.courses, course],
    timeslots,
  };
};

const prepareSchedules = (
  excludedTimeslots,
  selectedCourses,
  { allowCollisions = false } = {}
) => {
  const maxSchedules = allowCollisions ? MAX_COLLIDED_SCHEDULES : Infinity;

  let schedules = [];

  for (const selectedCourse of selectedCourses) {
    const newSchedules = [];

    const { selectedInstructor } = selectedCourse;
    let sections = Object.entries(selectedCourse.sections);

    if (selectedInstructor !== "All") {
      sections = sections.filter(
        ([, courseSection]) => courseSection.instructor === selectedInstructor
      );
    }

    for (const [sectionCode, courseSection] of sections) {
      courseSection.courseCode = `${selectedCourse.courseCode}-${sectionCode}`;
      courseSection.courseName = selectedCourse.name;

      // The first course starts from a single empty schedule to extend.
      for (const schedule of schedules.length ? schedules : [undefined]) {
        const newSchedule = buildSchedule(
          excludedTimeslots,
          courseSection,
          schedule || { timeslots: {}, courses: [] },
          allowCollisions
        );

        if (newSchedule) {
          newSchedules.push(newSchedule);
        }
      }
    }

    schedules = newSchedules.slice(0, maxSchedules);
  }

  return schedules;
};

const exportScheduleAsPNG = async () => {
  const canvas = await html2canvas(document.body, {});
  const link = document.createElement("a");
  const date = new Date().toLocaleString();

  link.href = canvas.toDataURL();
  link.download = `METU Scheduler - ${date}.png`;

  link.click();
};

export {
  MAX_COLLIDED_SCHEDULES,
  reduceOfferings,
  areTimeslotsOverlapping,
  buildSchedule,
  prepareSchedules,
  exportScheduleAsPNG,
};
