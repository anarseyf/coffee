const path = require("path");
const { getHistoryAsync } = require("../../../dispatchCompute");

import { extent as d3extent } from "d3-array";
import {
  toPacificDateString,
  toPacificStringMMMD,
  saveJSONAsync,
  readJSONAsync,
} from "../../../fileUtils";
import { datasetsPath, withScriptsJsonPath } from "../../../server/serverUtils";

const annotationsForYear = ({ binsLowRes, offset, start: yearStart }) => {
  let data = binsLowRes;
  let result = [];

  // TODO - make sure this works as intended past 2020
  if (offset === 0) {
    // Current year — ignore today's bin as it's incomplete
    data = binsLowRes.slice(0, -1);

    // const lastBin = data[data.length - 1];
    // const date = new Date(lastBin.x0);
    // const annotationToday = {
    //   end: {
    //     date: toPacificDateString(date),
    //     label: toPacificStringMMMD(date),
    //     value: lastBin.length,
    //   },
    // };
    // result.push(annotationToday);
  }
  const year = new Date(yearStart).getFullYear();
  const lengths = data
    .filter(({ length }) => length > 0)
    .map(({ length }) => length);
  const [min, max] = d3extent(lengths);
  const minBin = data.find(({ length }) => length === min);
  const maxBin = data.find(({ length }) => length === max);

  const minDate = new Date(minBin.x0 - offset);
  const maxDate = new Date(maxBin.x0 - offset);
  const minDateStr = toPacificDateString(minDate);
  const maxDateStr = toPacificDateString(maxDate);
  const annotationMin = {
    start: {
      date: minDateStr,
      title: `${year} low`,
      label: `${min} (${toPacificStringMMMD(minDate)})`,
      value: min,
    },
  };
  const annotationMax = {
    start: {
      date: maxDateStr,
      title: `${year} high`,
      label: `${max} (${toPacificStringMMMD(maxDate)})`,
      value: max,
    },
  };

  result = result.concat(annotationMin, annotationMax);
  return result;
};

const waitMinutes = 60;
const MINUTE = 60 * 1000;
const wait = waitMinutes * MINUTE;

export const runner = async () => {
  const now = new Date();

  const statusFile = withScriptsJsonPath("status.json");
  const status = await readJSONAsync(statusFile, {});
  console.log("annotate > status", status);
  if (now - ((status.update && +new Date(status.update.lastRun)) || 0) < wait) {
    console.log(`annotate > need to wait ${waitMinutes} min since last run`);
    return;
  }

  const history = await getHistoryAsync();

  const historyThisYear = history[0].intervals[0];
  const historyLastYear = history[0].intervals[1];

  const annotationsThisYear = annotationsForYear(historyThisYear);
  const annotationsLastYear = annotationsForYear(historyLastYear);

  const file = path.join(datasetsPath, "../misc/generatedAnnotations.json");
  await saveJSONAsync(file, [...annotationsLastYear, ...annotationsThisYear]);

  const end = new Date();
  console.log(`annotate > (${end - now}ms)`);
};
