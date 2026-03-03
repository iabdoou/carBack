import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { BuyerService } from './buyer.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('buyer')
@Controller('api/v1/buyer')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('BUYER')
@ApiBearerAuth()
export class BuyerController {
  constructor(private buyerService: BuyerService) {}

  @Get('profile')
  @ApiOperation({ summary: 'Get my profile with container tracking code' })
  @ApiResponse({ status: 200, description: 'Buyer profile' })
  async getProfile(@CurrentUser() user: any) {
    return this.buyerService.getProfile(user.sub);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get buyer dashboard stats' })
  @ApiResponse({ status: 200, description: 'Buyer stats' })
  async getStats(@CurrentUser() user: any) {
    return this.buyerService.getStats(user.sub);
  }

  @Get('orders')
  @ApiOperation({ summary: 'Get my orders' })
  @ApiQuery({ name: 'status', required: false })
  @ApiResponse({ status: 200, description: 'List of my orders' })
  async getMyOrders(
    @CurrentUser() user: any,
    @Query('status') status?: string,
  ) {
    return this.buyerService.getMyOrders(user.sub, status);
  }

  @Get('orders/:id')
  @ApiOperation({ summary: 'Get order detail with tracking' })
  @ApiResponse({ status: 200, description: 'Order details with progress' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async getOrderDetail(
    @CurrentUser() user: any,
    @Param('id') id: string,
  ) {
    return this.buyerService.getOrderDetail(user.sub, id);
  }

  @Get('timeline-steps/:mode')
  @ApiOperation({ summary: 'Get timeline steps for a listing mode' })
  @ApiResponse({ status: 200, description: 'Timeline steps' })
  async getTimelineSteps(@Param('mode') mode: string) {
    return this.buyerService.getTimelineSteps(mode);
  }
}
