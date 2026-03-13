import TOS from '@volcengine/tos-sdk';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

// TOS SDK 导出的是一个对象，TosClient 是其中的一个属性
const TosClient = TOS.TosClient;

/**
 * TOSService - 火山引擎对象存储服务
 * 
 * 用于将视频文件上传到火山引擎TOS对象存储，获取公网可访问的URL
 * 供AI服务进行视频分析
 */
class TOSService {
  
  /**
   * 创建TOS客户端实例
   * @private
   * @returns {TosClient} TOS客户端实例
   */
  static _createClient() {
    const accessKeyId = process.env.TOS_ACCESS_KEY_ID;
    const accessKeySecret = process.env.TOS_SECRET_ACCESS_KEY;
    const region = process.env.TOS_REGION || 'cn-guangzhou';
    
    if (!accessKeyId || !accessKeySecret) {
      throw new Error('TOS配置缺失：请在.env中配置 TOS_ACCESS_KEY_ID 和 TOS_SECRET_ACCESS_KEY');
    }
    
    // 创建TOS客户端
    const client = new TosClient({
      accessKeyId: accessKeyId,
      accessKeySecret: accessKeySecret,
      region: region,
      // 可选：自定义endpoint
      // endpoint: process.env.TOS_ENDPOINT
    });
    
    return client;
  }
  
  /**
   * 上传视频文件到TOS
   * @param {string} localFilePath - 本地视频文件路径
   * @param {Object} options - 上传选项
   * @param {string} options.bucket - 存储桶名称（可选，默认从环境变量读取）
   * @param {string} options.objectKey - 对象键名（可选，默认使用原文件名+时间戳）
   * @param {string} options.folder - 存储文件夹路径（可选，如 'videos/music-creation/'）
   * @returns {Promise<Object>} 上传结果，包含公网URL
   */
  static async uploadVideo(localFilePath, options = {}) {
    console.log('\n' + '='.repeat(80));
    console.log('📤 [TOS服务] 开始上传视频到对象存储');
    console.log('='.repeat(80));
    console.log(`📁 本地文件: ${localFilePath}`);
    
    try {
      // 检查文件是否存在
      if (!fs.existsSync(localFilePath)) {
        throw new Error(`本地文件不存在: ${localFilePath}`);
      }
      
      // 获取文件信息
      const fileStats = fs.statSync(localFilePath);
      const fileSizeInMB = (fileStats.size / 1024 / 1024).toFixed(2);
      console.log(`📊 文件大小: ${fileSizeInMB} MB`);
      
      // 创建TOS客户端
      const client = this._createClient();
      
      // 获取存储桶名称
      const bucket = options.bucket || process.env.TOS_BUCKET;
      if (!bucket) {
        throw new Error('TOS配置缺失：请在.env中配置 TOS_BUCKET 或通过options.bucket参数指定');
      }
      
      // 生成对象键名
      const fileName = path.basename(localFilePath);
      const timestamp = Date.now();
      const fileExt = path.extname(fileName);
      const baseName = path.basename(fileName, fileExt);
      
      // 构建对象键（如果指定了folder，则添加文件夹前缀）
      let objectKey;
      if (options.objectKey) {
        objectKey = options.objectKey;
      } else {
        const folder = options.folder || 'videos/music-creation/';
        // 确保folder以/结尾
        const normalizedFolder = folder.endsWith('/') ? folder : folder + '/';
        objectKey = `${normalizedFolder}${baseName}_${timestamp}${fileExt}`;
      }
      
      console.log(`🔑 对象键: ${objectKey}`);
      console.log(`🪣 存储桶: ${bucket}`);
      
      // 读取文件内容
      console.log('📖 读取文件内容...');
      const fileContent = fs.readFileSync(localFilePath);
      
      // 上传文件
      console.log('⬆️  开始上传...');
      const uploadStartTime = Date.now();
      
      const result = await client.putObject({
        bucket: bucket,
        key: objectKey,
        body: fileContent,
        contentType: 'video/mp4',
        // 设置ACL为public-read，使文件可以通过URL公开访问
        acl: 'public-read'
      });
      
      const uploadDuration = ((Date.now() - uploadStartTime) / 1000).toFixed(2);
      console.log(`✅ 上传完成！用时: ${uploadDuration}秒`);
      
      // 构建公网访问URL
      // 格式: https://{bucket}.tos-{region}.volces.com/{objectKey}
      const region = process.env.TOS_REGION || 'cn-guangzhou';
      const publicUrl = `https://${bucket}.tos-${region}.volces.com/${objectKey}`;
      
      console.log('🌐 公网访问URL:', publicUrl);
      console.log('='.repeat(80) + '\n');
      
      return {
        success: true,
        url: publicUrl,
        bucket: bucket,
        objectKey: objectKey,
        region: region,
        fileSize: fileStats.size,
        fileSizeInMB: parseFloat(fileSizeInMB),
        uploadDuration: parseFloat(uploadDuration),
        etag: result.ETag
      };
      
    } catch (error) {
      console.error('❌ [TOS服务] 上传失败:', error);
      console.error('错误详情:', error.message);
      console.log('='.repeat(80) + '\n');
      
      throw new Error(`上传视频到TOS失败: ${error.message}`);
    }
  }
  
  /**
   * 删除TOS上的文件
   * @param {string} objectKey - 对象键名
   * @param {string} bucket - 存储桶名称（可选，默认从环境变量读取）
   * @returns {Promise<Object>} 删除结果
   */
  static async deleteObject(objectKey, bucket = null) {
    console.log(`🗑️  [TOS服务] 删除对象: ${objectKey}`);
    
    try {
      const client = this._createClient();
      const targetBucket = bucket || process.env.TOS_BUCKET;
      
      if (!targetBucket) {
        throw new Error('TOS配置缺失：请在.env中配置 TOS_BUCKET');
      }
      
      await client.deleteObject({
        bucket: targetBucket,
        key: objectKey
      });
      
      console.log('✅ [TOS服务] 删除成功');
      
      return {
        success: true,
        bucket: targetBucket,
        objectKey: objectKey
      };
      
    } catch (error) {
      console.error('❌ [TOS服务] 删除失败:', error);
      throw new Error(`删除TOS对象失败: ${error.message}`);
    }
  }
  
  /**
   * 检查TOS配置是否正确
   * @returns {Promise<boolean>} 配置是否有效
   */
  static async checkConfiguration() {
    try {
      const client = this._createClient();
      const bucket = process.env.TOS_BUCKET;
      
      if (!bucket) {
        console.error('❌ TOS_BUCKET 未配置');
        return false;
      }
      
      // 尝试列出存储桶（验证凭证是否有效）
      await client.headBucket({ bucket });
      
      console.log('✅ TOS配置验证成功');
      return true;
      
    } catch (error) {
      console.error('❌ TOS配置验证失败:', error.message);
      return false;
    }
  }
  
  /**
   * 从TOS URL中提取bucket和objectKey
   * @param {string} tosUrl - TOS公网URL
   * @returns {Object} 包含bucket和objectKey的对象
   */
  static parseUrl(tosUrl) {
    try {
      // URL格式: https://{bucket}.tos-{region}.volces.com/{objectKey}
      const url = new URL(tosUrl);
      const bucket = url.hostname.split('.')[0];
      const objectKey = url.pathname.substring(1); // 移除开头的 /
      
      return {
        bucket,
        objectKey,
        region: url.hostname.match(/tos-([^.]+)/)?.[1]
      };
    } catch (error) {
      throw new Error(`无效的TOS URL: ${tosUrl}`);
    }
  }
}

export default TOSService;

