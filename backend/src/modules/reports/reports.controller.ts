import { Controller, Get, Param, Query, Res, StreamableFile } from '@nestjs/common';
import { ApiProduces, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import type { z } from 'zod';
import { CurrentUser, Roles } from '../../common/auth/decorators.js';
import {
  type ContractorReportQuery,
  contractorReportQuerySchema,
  idSchema,
  type ObjectReportQuery,
  objectReportQuerySchema,
  type SessionUser,
  summaryReportQuerySchema,
} from '../../contracts/index.js';
import { ReportsService } from './reports.service.js';
import { contentDisposition } from './xlsx.js';

const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Выгрузки в Excel. Бригадиру отчёты не нужны. */
@ApiTags('reports')
@Roles('ADMIN', 'MANAGER', 'FINANCE')
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  private send(res: Response, file: { buffer: Buffer; fileName: string }) {
    res.setHeader('Content-Disposition', contentDisposition(file.fileName));
    res.setHeader('Cache-Control', 'no-store');
    return new StreamableFile(file.buffer, { type: XLSX });
  }

  @Get('contractor.xlsx')
  @ApiProduces(XLSX)
  async contractor(
    @Query({ schema: contractorReportQuerySchema }) q: ContractorReportQuery,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.send(res, await this.reports.contractor(q));
  }

  @Get('summary.xlsx')
  @ApiProduces(XLSX)
  async summary(
    @Query({ schema: summaryReportQuerySchema }) q: z.output<typeof summaryReportQuerySchema>,
    @CurrentUser() user: SessionUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.send(res, await this.reports.summary(q, user));
  }

  @Get('objects/:id/report.xlsx')
  @ApiProduces(XLSX)
  async object(
    @Param('id', { schema: idSchema }) id: string,
    @Query({ schema: objectReportQuerySchema }) q: ObjectReportQuery,
    @CurrentUser() user: SessionUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.send(res, await this.reports.object(id, q, user));
  }
}
