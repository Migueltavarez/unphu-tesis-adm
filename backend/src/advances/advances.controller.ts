import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { AdvancesService } from './advances.service';
import { CreateAdvanceDto, CreateAdvanceCommentDto, ReviewAdvanceDto } from './dto/advance.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('advances')
@ApiBearerAuth('JWT')
@Controller('thesis-works/:thesisWorkId/advances')
export class AdvancesController {
  constructor(private readonly advancesService: AdvancesService) {}

  @Post()
  @Roles(UserRole.STUDENT)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Enviar un nuevo avance' })
  create(
    @Param('thesisWorkId') thesisWorkId: string,
    @Body() dto: CreateAdvanceDto,
    @CurrentUser('id') userId: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 50 * 1024 * 1024 }), // 50MB
          new FileTypeValidator({ fileType: 'application/pdf' }),
        ],
        fileIsRequired: false,
      }),
    )
    file?: Express.Multer.File,
  ) {
    // En producción, subir a R2 y guardar URL
    const fileUrl = file ? `uploads/${file.originalname}` : undefined;
    const fileName = file?.originalname;
    return this.advancesService.create(thesisWorkId, dto, userId, fileUrl, fileName);
  }

  @Get()
  @ApiOperation({ summary: 'Listar avances del trabajo de grado' })
  findAll(@Param('thesisWorkId') thesisWorkId: string) {
    return this.advancesService.findByThesisWork(thesisWorkId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener detalle de un avance' })
  findOne(@Param('id') id: string) {
    return this.advancesService.findOne(id);
  }

  @Patch(':id/review')
  @Roles(UserRole.ADVISOR, UserRole.COORDINATOR)
  @ApiOperation({ summary: 'Revisar y aprobar/rechazar avance' })
  review(
    @Param('id') id: string,
    @Body() dto: ReviewAdvanceDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.advancesService.review(id, dto, userId);
  }

  @Post(':id/comments')
  @ApiOperation({ summary: 'Agregar comentario a un avance' })
  addComment(
    @Param('id') id: string,
    @Body() dto: CreateAdvanceCommentDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.advancesService.addComment(id, dto, userId);
  }
}
