import { MsgView } from "../../../buffer";
import { AsciiSession } from "../../../transport";
import { MsgType } from "../../../types";
import {
  ITradeCaptureReport,
  ITradeCaptureReportRequest,
  ITradeCaptureReportRequestAck,
} from "../../../types/FIX4.4/repo";
import { IJsFixLogger, IJsFixConfig } from "../../../config";
import { Dictionary } from "../../../collections";
import { TradeFactory } from "./trade-factory";

export class TradeCaptureClient extends AsciiSession {
  private readonly logger: IJsFixLogger;
  private readonly fixLog: IJsFixLogger;
  private reports: Dictionary<ITradeCaptureReport>;

  constructor(public readonly config: IJsFixConfig) {
    super(config);
    this.logReceivedMsgs = true;
    this.reports = new Dictionary<ITradeCaptureReport>();
    this.fixLog = config.logFactory.plain(
      `jsfix.${config.description.application.name}.txt`
    );
    this.logger = config.logFactory.logger(`${this.me}:TradeCaptureClient`);
  }

  protected onApplicationMsg(msgType: string, view: MsgView): void {
    this.logger.info(`${view.toJson()}`);
    switch (msgType) {
      case MsgType.TradeCaptureReport: {
        // create an object and cast to the interface
        const tc: ITradeCaptureReport = view.toObject();
        this.reports.addUpdate(tc.TradeReportID, tc);
        this.logger.info(
          `[reports: ${this.reports.count()}] received tc ExecID = ${
            tc.ExecID
          } TradeReportID  = ${tc.TradeReportID} Symbol = ${
            tc.Instrument.Symbol
          } ${tc.LastQty} @ ${tc.LastPx}`
        );
        break;
      }

      case MsgType.TradeCaptureReportRequestAck: {
        const tc: ITradeCaptureReportRequestAck = view.toObject();
        this.logger.info(
          `received tcr ack ${tc.TradeRequestID} ${tc.TradeRequestStatus}`
        );
        break;
      }
    }
  }

  protected onStopped(): void {
    this.logger.info("stopped");
  }

  // use msgType for example to persist only trade capture messages to database
  protected onDecoded(msgType: string, txt: string): void {
    this.fixLog.info(txt);
  }

  // delimiter substitution now done in encoding
  protected onEncoded(msgType: string, txt: string): void {
    this.fixLog.info(txt);
  }

  private logoutTimer(logoutSeconds: number = 32) {
    setTimeout(() => {
      this.done();
    }, logoutSeconds * 1000);
  }

  protected onReady(view: MsgView): void {
    this.logger.info("ready to send  tcr (single & double)");

    // two dates
    const nowDate = new Date();
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - 1);

    const tcr2: ITradeCaptureReportRequest =
      TradeFactory.tradeCaptureReportRequest("all-trades", sinceDate, nowDate);
    // send request to server
    this.send(MsgType.TradeCaptureReportRequest, tcr2);

    //
    // use signature below for brokers accepting single date (until now) format
    //
    /*
    const tcr: ITradeCaptureReportRequest =
    TradeFactory.tradeCaptureReportRequest("all-trades", sinceDate);
    this.send(MsgType.TradeCaptureReportRequest, tcr);
    */

    const logoutSeconds = 32;
    this.logger.info(`will logout after ${logoutSeconds}`);
    this.logoutTimer();
  }

  protected onLogon(view: MsgView, user: string, password: string): boolean {
    this.logger.info(`onLogon user ${user}`);
    return true;
  }
}
