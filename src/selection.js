// Saving a selection keeps only what identifies the chosen courses: their
// department, code, and instructor filter. Section days, hours, and rooms are
// deliberately left out, because SIS revises them constantly - they are read
// fresh from the current offerings when the selection is loaded back.

const toSavedCourses = (selectedCourses) =>
  selectedCourses.map(({ departmentCode, courseCode, selectedInstructor }) => ({
    departmentCode,
    courseCode,
    selectedInstructor: selectedInstructor || "All",
  }));

const getInstructors = ({ sections }) =>
  new Set(Object.values(sections).map(({ instructor }) => instructor));

const restoreCourses = (savedCourses, offerings) => {
  const offeringsByCode = new Map(
    offerings.map((offering) => [
      `${offering.departmentCode}|${offering.courseCode}`,
      offering,
    ])
  );

  const courses = [];
  const missing = [];
  const resetInstructors = [];

  const entries = (Array.isArray(savedCourses) ? savedCourses : []).filter(
    (saved) => saved && saved.departmentCode && saved.courseCode
  );

  for (const saved of entries) {
    const offering = offeringsByCode.get(
      `${saved.departmentCode}|${saved.courseCode}`
    );

    if (!offering) {
      missing.push(saved.courseCode);
    } else if (
      !saved.selectedInstructor ||
      saved.selectedInstructor === "All"
    ) {
      // Hand back the same object the course picker would, so the selection
      // behaves exactly like one made by hand.
      courses.push(offering);
    } else if (getInstructors(offering).has(saved.selectedInstructor)) {
      courses.push({
        ...offering,
        selectedInstructor: saved.selectedInstructor,
      });
    } else {
      // The instructor no longer teaches this course, so keeping the filter
      // would leave the course with no schedule at all.
      resetInstructors.push(saved.courseCode);
      courses.push(offering);
    }
  }

  return { courses, missing, resetInstructors };
};

export { toSavedCourses, restoreCourses };
