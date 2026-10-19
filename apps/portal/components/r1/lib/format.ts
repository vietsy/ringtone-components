// The format helpers R1 publishes as `format`, for a screen that renders a value outside a component.
import {
  formatCount,
  formatDate,
  formatMoney,
  formatPercent,
  formatPeriod,
  formatStamp,
  formatTime,
  formatTimestamp,
} from "./formatting";
import { formatDateShort } from "../DateValue";

export const format: {
  money: typeof formatMoney;
  count: typeof formatCount;
  percent: typeof formatPercent;
  date: typeof formatDate;
  dateShort: typeof formatDateShort;
  timestamp: typeof formatTimestamp;
  stamp: typeof formatStamp;
  period: typeof formatPeriod;
  time: typeof formatTime;
} = {
  money: formatMoney,
  count: formatCount,
  percent: formatPercent,
  date: formatDate,
  dateShort: formatDateShort,
  timestamp: formatTimestamp,
  stamp: formatStamp,
  period: formatPeriod,
  time: formatTime,
};
