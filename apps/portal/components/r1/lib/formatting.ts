"use client";

// The format rules live in @rightone/formatting (R23.7): one place renders money, counts and dates.
import { R1_FORMAT } from "@rightone/formatting";

export const nf: typeof R1_FORMAT.nf = R1_FORMAT.nf;

export const formatCount: typeof R1_FORMAT.formatCount = R1_FORMAT.formatCount;

export const formatPercent: typeof R1_FORMAT.formatPercent = R1_FORMAT.formatPercent;

export const formatMoney: typeof R1_FORMAT.formatMoney = R1_FORMAT.formatMoney;

export const toDate: typeof R1_FORMAT.toDate = R1_FORMAT.toDate;

export const dtf: typeof R1_FORMAT.dtf = R1_FORMAT.dtf;

export const offsetLabel: typeof R1_FORMAT.offsetLabel = R1_FORMAT.offsetLabel;

export const formatDate: typeof R1_FORMAT.formatDate = R1_FORMAT.formatDate;

export const formatTime: typeof R1_FORMAT.formatTime = R1_FORMAT.formatTime;

export const shortMonth: typeof R1_FORMAT.shortMonth = R1_FORMAT.shortMonth;

export const formatTimestamp: typeof R1_FORMAT.formatTimestamp = R1_FORMAT.formatTimestamp;

export const formatStamp: typeof R1_FORMAT.formatStamp = R1_FORMAT.formatStamp;

export const formatPeriod: typeof R1_FORMAT.formatPeriod = R1_FORMAT.formatPeriod;
